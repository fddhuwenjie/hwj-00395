const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

const { UserDAO, AuctionDAO, BidDAO, TransactionDAO, WatchlistDAO, uuidv4 } = require('./db.js');
const { generateToken, authMiddleware, verifySocketToken } = require('./auth.js');

const app = express();
const server = http.createServer(app);

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const socketUsers = new Map();

const getAuctionStatus = (auction) => {
  const now = Date.now();
  if (now < auction.startTime) return 'pending';
  if (now > auction.endTime) {
    if (auction.status !== 'ended') {
      auction.status = 'ended';
      if (auction.bidCount > 0 && !auction.winnerId) {
        const auctionBids = BidDAO.getByAuction(auction.id).sort((a, b) => b.price - a.price);
        if (auctionBids.length > 0) {
          const winner = auctionBids[0];
          auction.winnerId = winner.userId;
          auction.finalPrice = winner.price;
          const seller = UserDAO.getById(auction.sellerId);
          if (seller) {
            seller.balance += auction.finalPrice;
            UserDAO.updateBalance(seller.id, seller.balance);
          }
          const winnerUser = UserDAO.getById(winner.userId);
          if (winnerUser) {
            winnerUser.balance -= (auction.finalPrice - auction.deposit);
            UserDAO.updateBalance(winnerUser.id, winnerUser.balance);
          }
          const tx1 = {
            id: uuidv4(),
            userId: auction.sellerId,
            type: 'income',
            amount: auction.finalPrice,
            description: `出售《${auction.title}》成交`,
            auctionId: auction.id,
            createdAt: now
          };
          TransactionDAO.create(tx1);
          const tx2 = {
            id: uuidv4(),
            userId: winner.userId,
            type: 'expense',
            amount: auction.finalPrice,
            description: `拍得《${auction.title}》`,
            auctionId: auction.id,
            createdAt: now
          };
          TransactionDAO.create(tx2);
        }
      } else if (auction.bidCount === 0) {
        auction.winnerId = null;
        auction.finalPrice = null;
      }
      AuctionDAO.update(auction);
    }
    return 'ended';
  }
  return 'active';
};

const syncAuctionTimers = () => {
  AuctionDAO.getAll().forEach(a => getAuctionStatus(a));
};
setInterval(syncAuctionTimers, 1000);

setInterval(() => {
  const now = Date.now();
  const statuses = {};
  AuctionDAO.getAll().forEach(a => {
    statuses[a.id] = {
      endTime: a.endTime,
      currentPrice: a.currentPrice,
      bidCount: a.bidCount,
      status: a.status
    };
  });
  io.emit('auction:timers', statuses);
}, 1000);

const getUserSafe = (user) => {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
};

app.post('/api/auth/register', (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password || !nickname) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  const exists = UserDAO.getByUsername(username);
  if (exists) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  const id = uuidv4();
  const user = {
    id,
    username,
    password: bcrypt.hashSync(password, 10),
    nickname,
    balance: 10000,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    createdAt: Date.now()
  };
  UserDAO.create(user);
  const token = generateToken(user);
  res.json({ token, user: getUserSafe(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }
  const user = UserDAO.getByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = generateToken(user);
  res.json({ token, user: getUserSafe(user) });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = UserDAO.getById(req.user.id);
  res.json({ user: getUserSafe(user) });
});

app.post('/api/wallet/recharge', authMiddleware, (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: '充值金额无效' });
  }
  const user = UserDAO.getById(req.user.id);
  const newBalance = user.balance + amount;
  UserDAO.updateBalance(user.id, newBalance);
  const tx = {
    id: uuidv4(),
    userId: user.id,
    type: 'income',
    amount,
    description: '账户充值',
    createdAt: Date.now()
  };
  TransactionDAO.create(tx);
  res.json({ balance: newBalance });
});

app.get('/api/auctions', (req, res) => {
  const { status, category } = req.query;
  let list = AuctionDAO.getAll();
  list = list.map(a => {
    getAuctionStatus(a);
    return a;
  });
  if (status) {
    list = list.filter(a => a.status === status);
  }
  if (category) {
    list = list.filter(a => a.category === category);
  }
  list.sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return b.bidCount - a.bidCount;
  });
  res.json(list.map(a => {
    const seller = UserDAO.getById(a.sellerId);
    return {
      ...a,
      sellerNickname: seller ? seller.nickname : '未知',
      sellerAvatar: seller ? seller.avatar : ''
    };
  }));
});

app.get('/api/auctions/:id', (req, res) => {
  const auction = AuctionDAO.getById(req.params.id);
  if (!auction) return res.status(404).json({ error: '拍品不存在' });
  getAuctionStatus(auction);
  const seller = UserDAO.getById(auction.sellerId);
  const winner = auction.winnerId ? UserDAO.getById(auction.winnerId) : null;
  res.json({
    ...auction,
    sellerNickname: seller ? seller.nickname : '未知',
    sellerAvatar: seller ? seller.avatar : '',
    winnerNickname: winner ? winner.nickname : null
  });
});

app.post('/api/auctions', authMiddleware, (req, res) => {
  const { title, description, images, category, startPrice, minIncrement, deposit, startTime, endTime, buyNowPrice } = req.body;
  if (!title || !description || !startPrice || !minIncrement || !deposit || !startTime || !endTime) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  const auction = {
    id: uuidv4(),
    title,
    description,
    images: images || [],
    category: category || '其他',
    startPrice,
    minIncrement,
    deposit,
    startTime,
    endTime,
    buyNowPrice: buyNowPrice || null,
    sellerId: req.user.id,
    currentPrice: startPrice,
    bidCount: 0,
    watcherCount: 0,
    status: 'pending',
    winnerId: null,
    finalPrice: null,
    createdAt: Date.now()
  };
  AuctionDAO.create(auction);
  io.emit('auction:new', auction);
  res.json(auction);
});

app.post('/api/auctions/:id/bid', authMiddleware, (req, res) => {
  let auction = AuctionDAO.getById(req.params.id);
  if (!auction) return res.status(404).json({ error: '拍品不存在' });
  getAuctionStatus(auction);
  if (auction.status !== 'active') {
    return res.status(400).json({ error: '拍卖未开始或已结束' });
  }
  if (auction.sellerId === req.user.id) {
    return res.status(400).json({ error: '不能对自己的拍品出价' });
  }
  const { price, buyNow } = req.body;
  let user = UserDAO.getById(req.user.id);
  if (!user) return res.status(401).json({ error: '用户不存在' });

  let finalPrice;
  if (buyNow && auction.buyNowPrice) {
    finalPrice = auction.buyNowPrice;
  } else {
    if (!price) return res.status(400).json({ error: '请输入出价金额' });
    finalPrice = price;
    const minBid = auction.currentPrice + auction.minIncrement;
    if (finalPrice < minBid) {
      return res.status(400).json({ error: `出价必须不低于 ${minBid}` });
    }
  }

  const totalRequired = finalPrice;
  if (user.balance < totalRequired) {
    return res.status(400).json({ error: '余额不足' });
  }

  const prevBids = BidDAO.getByAuction(auction.id);
  const myPrevBid = prevBids.find(b => b.userId === req.user.id && b.price === auction.currentPrice);
  prevBids.forEach(b => {
    if (b.userId !== req.user.id) {
      const bidder = UserDAO.getById(b.userId);
      if (bidder) {
        bidder.balance += auction.deposit;
        UserDAO.updateBalance(bidder.id, bidder.balance);
      }
    }
  });

  user = UserDAO.getById(req.user.id);
  if (!myPrevBid) {
    user.balance -= auction.deposit;
    UserDAO.updateBalance(user.id, user.balance);
  }

  const bid = {
    id: uuidv4(),
    auctionId: auction.id,
    userId: req.user.id,
    price: finalPrice,
    time: Date.now()
  };
  BidDAO.create(bid);
  auction.currentPrice = finalPrice;
  auction.bidCount++;

  const timeLeft = auction.endTime - Date.now();
  if (timeLeft < 5 * 60 * 1000 && timeLeft > 0) {
    auction.endTime = Date.now() + 3 * 60 * 1000;
  }

  if (buyNow && auction.buyNowPrice) {
    auction.status = 'ended';
    auction.winnerId = req.user.id;
    auction.finalPrice = finalPrice;
    const seller = UserDAO.getById(auction.sellerId);
    if (seller) {
      seller.balance += finalPrice;
      UserDAO.updateBalance(seller.id, seller.balance);
    }
    user = UserDAO.getById(req.user.id);
    user.balance -= (finalPrice - auction.deposit);
    UserDAO.updateBalance(user.id, user.balance);
    const tx1 = {
      id: uuidv4(),
      userId: auction.sellerId,
      type: 'income',
      amount: finalPrice,
      description: `出售《${auction.title}》成交`,
      auctionId: auction.id,
      createdAt: Date.now()
    };
    TransactionDAO.create(tx1);
    const tx2 = {
      id: uuidv4(),
      userId: req.user.id,
      type: 'expense',
      amount: finalPrice,
      description: `一口价购买《${auction.title}》`,
      auctionId: auction.id,
      createdAt: Date.now()
    };
    TransactionDAO.create(tx2);
  }

  AuctionDAO.update(auction);
  user = UserDAO.getById(req.user.id);

  const bidderInfo = {
    id: bid.id,
    auctionId: bid.auctionId,
    userId: bid.userId,
    nickname: user.nickname,
    avatar: user.avatar,
    price: bid.price,
    time: bid.time
  };

  io.emit('bid:new', { ...bidderInfo, auctionEndTime: auction.endTime });

  const watchers = WatchlistDAO.getByUser(req.user.id).filter(id => id !== auction.id);
  WatchlistDAO.getByUser(req.user.id).forEach(() => {});
  const allWatchers = new Set();
  UserDAO.getAll().forEach(u => {
    if (u.id !== req.user.id) {
      const wl = WatchlistDAO.getByUser(u.id);
      if (wl.includes(auction.id)) allWatchers.add(u.id);
    }
  });
  BidDAO.getByAuction(auction.id).forEach(b => {
    if (b.userId !== req.user.id) allWatchers.add(b.userId);
  });

  allWatchers.forEach(uid => {
    const sockets = Array.from(socketUsers.entries()).filter(([_, u]) => u && u.userId === uid).map(([sid]) => sid);
    sockets.forEach(sid => {
      io.to(sid).emit('bid:outbid', {
        auctionId: auction.id,
        auctionTitle: auction.title,
        newPrice: finalPrice,
        bidderNickname: user.nickname
      });
    });
  });

  res.json({ success: true, bid: bidderInfo, auction });
});

app.get('/api/auctions/:id/bids', (req, res) => {
  const auctionBids = BidDAO.getByAuction(req.params.id);
  const result = auctionBids.map(b => {
    const user = UserDAO.getById(b.userId);
    return {
      ...b,
      nickname: user ? user.nickname : '未知',
      avatar: user ? user.avatar : ''
    };
  });
  res.json(result);
});

app.post('/api/auctions/:id/watch', authMiddleware, (req, res) => {
  const auctionId = req.params.id;
  const userId = req.user.id;
  let watched;
  if (WatchlistDAO.has(userId, auctionId)) {
    WatchlistDAO.remove(userId, auctionId);
    watched = false;
  } else {
    WatchlistDAO.add(userId, auctionId);
    watched = true;
  }
  const auction = AuctionDAO.getById(auctionId);
  if (auction) {
    auction.watcherCount = Math.max(0, auction.watcherCount + (watched ? 1 : -1));
    AuctionDAO.update(auction);
  }
  res.json({ watched });
});

app.get('/api/watchlist', authMiddleware, (req, res) => {
  const list = WatchlistDAO.getByUser(req.user.id);
  res.json(list);
});

app.get('/api/my/auctions', authMiddleware, (req, res) => {
  const myList = AuctionDAO.getAll()
    .filter(a => a.sellerId === req.user.id)
    .map(a => { getAuctionStatus(a); return a; });
  res.json(myList);
});

app.get('/api/my/bids', authMiddleware, (req, res) => {
  const myBids = BidDAO.getByUser(req.user.id);
  const auctionIds = [...new Set(myBids.map(b => b.auctionId))];
  const result = auctionIds.map(id => {
    const auction = AuctionDAO.getById(id);
    if (!auction) return null;
    getAuctionStatus(auction);
    const myMaxBid = Math.max(...myBids.filter(b => b.auctionId === id).map(b => b.price));
    return { ...auction, myMaxBid };
  }).filter(Boolean);
  res.json(result);
});

app.get('/api/my/won', authMiddleware, (req, res) => {
  const won = AuctionDAO.getAll()
    .filter(a => a.winnerId === req.user.id)
    .map(a => { getAuctionStatus(a); return a; });
  res.json(won);
});

app.get('/api/my/transactions', authMiddleware, (req, res) => {
  const txs = TransactionDAO.getByUser(req.user.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(txs);
});

app.get('/api/stats', (req, res) => {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartTs = todayStart.getTime();

  const todayTransactions = TransactionDAO.getAll().filter(t => t.type === 'income' && t.createdAt >= todayStartTs && t.description && t.description.includes('出售'));
  const todayAmount = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

  const activeAuctions = AuctionDAO.getAll().filter(a => {
    getAuctionStatus(a);
    return a.status === 'active';
  });

  const totalBidCount = BidDAO.getAll().length;

  const top5 = AuctionDAO.getAll()
    .sort((a, b) => b.bidCount - a.bidCount)
    .slice(0, 5)
    .map(a => ({
      id: a.id,
      title: a.title,
      bidCount: a.bidCount,
      currentPrice: a.currentPrice,
      images: a.images,
      category: a.category
    }));

  const priceDistribution = [
    { range: '0-1万', count: 0 },
    { range: '1-5万', count: 0 },
    { range: '5-10万', count: 0 },
    { range: '10-50万', count: 0 },
    { range: '50万以上', count: 0 }
  ];
  AuctionDAO.getAll().forEach(a => {
    const p = a.finalPrice || a.currentPrice;
    if (p < 10000) priceDistribution[0].count++;
    else if (p < 50000) priceDistribution[1].count++;
    else if (p < 100000) priceDistribution[2].count++;
    else if (p < 500000) priceDistribution[3].count++;
    else priceDistribution[4].count++;
  });

  const dailyTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 24 * 3600 * 1000;
    const dayBids = BidDAO.getAll().filter(b => b.time >= dayStart && b.time < dayEnd).length;
    const daySales = TransactionDAO.getAll().filter(t => t.type === 'income' && t.createdAt >= dayStart && t.createdAt < dayEnd && t.description && t.description.includes('出售')).reduce((s, t) => s + t.amount, 0);
    dailyTrend.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      bidCount: dayBids,
      salesAmount: daySales
    });
  }

  res.json({
    todayAmount,
    activeCount: activeAuctions.length,
    totalBidCount,
    top5,
    priceDistribution,
    dailyTrend
  });
});

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  let user = null;
  if (token) {
    const decoded = verifySocketToken(token);
    if (decoded) {
      user = decoded;
      socketUsers.set(socket.id, { userId: user.id, nickname: user.nickname });
    }
  }

  socket.on('disconnect', () => {
    socketUsers.delete(socket.id);
  });
});

const PORT = 8395;
server.listen(PORT, () => {
  console.log(`Auction backend running on port ${PORT} (SQLite)`);
});
