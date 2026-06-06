const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');

const { UserDAO, AuctionDAO, BidDAO, TransactionDAO, WatchlistDAO, FavoriteDAO, ReviewDAO, ReportDAO, CertificationDAO, DelayRecordDAO, AuctionSpecialDAO, ProxyBidDAO, ReminderDAO, NotificationDAO, uuidv4 } = require('./db.js');
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
  const sevenDaysBeforeStart = auction.startTime - 7 * 24 * 3600 * 1000;
  if (now < sevenDaysBeforeStart) return 'upcoming';
  if (now >= sevenDaysBeforeStart && now < auction.startTime) return 'preview';
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

const calcCreditScore = (userId) => {
  const avg = ReviewDAO.getAverageRating(userId);
  UserDAO.updateCreditScore(userId, avg);
  return avg;
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
    creditScore: 5,
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
    const cert = CertificationDAO.getByAuction(a.id);
    const special = a.specialId ? AuctionSpecialDAO.getById(a.specialId) : null;
    return {
      ...a,
      sellerNickname: seller ? seller.nickname : '未知',
      sellerAvatar: seller ? seller.avatar : '',
      sellerCreditScore: seller ? seller.creditScore : 5,
      hasCertification: !!cert,
      specialName: special ? special.name : null
    };
  }));
});

app.get('/api/auctions/:id', (req, res) => {
  const auction = AuctionDAO.getById(req.params.id);
  if (!auction) return res.status(404).json({ error: '拍品不存在' });
  getAuctionStatus(auction);
  const seller = UserDAO.getById(auction.sellerId);
  const winner = auction.winnerId ? UserDAO.getById(auction.winnerId) : null;
  const certification = CertificationDAO.getByAuction(req.params.id);
  const delayRecords = DelayRecordDAO.getByAuction(req.params.id).map(r => {
    const bidder = UserDAO.getById(r.bidderId);
    return { ...r, bidderNickname: bidder ? bidder.nickname : '未知' };
  });
  const special = auction.specialId ? AuctionSpecialDAO.getById(auction.specialId) : null;
  res.json({
    ...auction,
    sellerNickname: seller ? seller.nickname : '未知',
    sellerAvatar: seller ? seller.avatar : '',
    sellerCreditScore: seller ? seller.creditScore : 5,
    winnerNickname: winner ? winner.nickname : null,
    certification,
    delayRecords,
    special
  });
});

app.post('/api/auctions', authMiddleware, (req, res) => {
  const { title, description, images, category, specialId, startPrice, minIncrement, deposit, startTime, endTime, buyNowPrice, certification } = req.body;
  if (!title || !description || !startPrice || !minIncrement || !deposit || !startTime || !endTime) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  const auctionId = uuidv4();
  const auction = {
    id: auctionId,
    title,
    description,
    images: images || [],
    category: category || '其他',
    specialId: specialId || null,
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
    favoriteCount: 0,
    delayCount: 0,
    status: 'pending',
    winnerId: null,
    finalPrice: null,
    createdAt: Date.now()
  };
  AuctionDAO.create(auction);
  if (certification && certification.agency && certification.certNumber && certification.certDate && certification.conclusion) {
    CertificationDAO.create({
      id: uuidv4(),
      auctionId,
      agency: certification.agency,
      certNumber: certification.certNumber,
      certDate: certification.certDate,
      conclusion: certification.conclusion,
      description: certification.description || null,
      antiFakeCode: 'AF-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      createdAt: Date.now()
    });
  }
  io.emit('auction:new', auction);
  res.json(auction);
});

const createBidRecord = (auction, userId, price, isProxy = false, skipDelay = false) => {
  const user = UserDAO.getById(userId);
  if (!user) return null;

  const prevBids = BidDAO.getByAuction(auction.id);
  const isCurrentBidder = prevBids.some(b => b.userId === userId && b.price === auction.currentPrice);

  prevBids.forEach(b => {
    if (b.userId !== userId) {
      const bidder = UserDAO.getById(b.userId);
      if (bidder) {
        bidder.balance += auction.deposit;
        UserDAO.updateBalance(bidder.id, bidder.balance);
      }
    }
  });

  const latestUser = UserDAO.getById(userId);
  if (!isCurrentBidder) {
    latestUser.balance -= auction.deposit;
    UserDAO.updateBalance(userId, latestUser.balance);
  }

  const bid = {
    id: uuidv4(),
    auctionId: auction.id,
    userId,
    price,
    time: Date.now(),
    isProxy
  };
  BidDAO.create(bid);
  auction.currentPrice = price;
  auction.bidCount++;

  if (!skipDelay) {
    const timeLeft = auction.endTime - Date.now();
    if (timeLeft < 5 * 60 * 1000 && timeLeft > 0 && auction.delayCount < 5) {
      const oldEndTime = auction.endTime;
      auction.endTime = Date.now() + 3 * 60 * 1000;
      auction.delayCount = (auction.delayCount || 0) + 1;
      DelayRecordDAO.create({
        id: uuidv4(),
        auctionId: auction.id,
        bidderId: userId,
        triggerTime: Date.now(),
        oldEndTime,
        newEndTime: auction.endTime
      });
    }
  }

  AuctionDAO.update(auction);
  return { bid, user: latestUser };
};

const notifyBidWatchers = (auction, finalPrice, bidderUser, excludeUserId = null) => {
  const allWatchers = new Set();
  UserDAO.getAll().forEach(u => {
    if (!excludeUserId || u.id !== excludeUserId) {
      const wl = WatchlistDAO.getByUser(u.id);
      if (wl.includes(auction.id)) allWatchers.add(u.id);
    }
  });
  BidDAO.getByAuction(auction.id).forEach(b => {
    if (!excludeUserId || b.userId !== excludeUserId) allWatchers.add(b.userId);
  });

  allWatchers.forEach(uid => {
    const sockets = Array.from(socketUsers.entries()).filter(([_, u]) => u && u.userId === uid).map(([sid]) => sid);
    sockets.forEach(sid => {
      io.to(sid).emit('bid:outbid', {
        auctionId: auction.id,
        auctionTitle: auction.title,
        newPrice: finalPrice,
        bidderNickname: bidderUser.nickname
      });
      io.to(sid).emit('watch:bid_notify', {
        auctionId: auction.id,
        auctionTitle: auction.title,
        newPrice: finalPrice,
        bidderNickname: bidderUser.nickname
      });
    });
  });
};

const processProxyBids = (auction, lastBidderId) => {
  let processed = false;
  let continueLoop = true;

  while (continueLoop) {
    continueLoop = false;
    const activeProxies = ProxyBidDAO.getByAuction(auction.id).filter(p => p.userId !== lastBidderId);
    if (activeProxies.length === 0) break;

    for (const proxy of activeProxies) {
      const minBid = auction.currentPrice + auction.minIncrement;
      if (proxy.maxPrice >= minBid) {
        const proxyUser = UserDAO.getById(proxy.userId);
        if (!proxyUser || proxyUser.balance < minBid) continue;

        const nextPrice = Math.min(proxy.maxPrice, Math.max(minBid, auction.currentPrice + auction.minIncrement));
        const result = createBidRecord(auction, proxy.userId, nextPrice, true, true);
        if (!result) continue;

        processed = true;
        lastBidderId = proxy.userId;

        const bidderInfo = {
          id: result.bid.id,
          auctionId: result.bid.auctionId,
          userId: result.bid.userId,
          nickname: result.user.nickname,
          avatar: result.user.avatar,
          price: result.bid.price,
          time: result.bid.time,
          isProxy: true
        };
        io.emit('bid:new', { ...bidderInfo, auctionEndTime: auction.endTime, delayCount: auction.delayCount });
        notifyBidWatchers(auction, nextPrice, result.user, proxy.userId);

        continueLoop = true;
        break;
      }
    }
  }
  return processed;
};

app.post('/api/auctions/:id/bid', authMiddleware, (req, res) => {
  let auction = AuctionDAO.getById(req.params.id);
  if (!auction) return res.status(404).json({ error: '拍品不存在' });
  const status = getAuctionStatus(auction);
  if (status !== 'active') {
    if (status === 'preview') return res.status(400).json({ error: '拍品正在预展中，尚未开始出价' });
    return res.status(400).json({ error: '拍卖未开始或已结束' });
  }
  if (auction.sellerId === req.user.id) {
    return res.status(400).json({ error: '不能对自己的拍品出价' });
  }
  const { price, buyNow, confirmLowCredit } = req.body;
  let user = UserDAO.getById(req.user.id);
  if (!user) return res.status(401).json({ error: '用户不存在' });

  if (user.creditScore < 3 && !confirmLowCredit) {
    return res.status(400).json({
      error: '您的信用分较低，继续出价将可能影响交易安全',
      lowCredit: true,
      creditScore: user.creditScore
    });
  }

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

  const result = createBidRecord(auction, req.user.id, finalPrice, false, false);
  if (!result) return res.status(500).json({ error: '出价失败' });

  if (buyNow && auction.buyNowPrice) {
    auction.status = 'ended';
    auction.winnerId = req.user.id;
    auction.finalPrice = finalPrice;
    const seller = UserDAO.getById(auction.sellerId);
    if (seller) {
      seller.balance += finalPrice;
      UserDAO.updateBalance(seller.id, seller.balance);
    }
    const latestUser = UserDAO.getById(req.user.id);
    latestUser.balance -= (finalPrice - auction.deposit);
    UserDAO.updateBalance(req.user.id, latestUser.balance);
    TransactionDAO.create({ id: uuidv4(), userId: auction.sellerId, type: 'income', amount: finalPrice, description: `出售《${auction.title}》成交`, auctionId: auction.id, createdAt: Date.now() });
    TransactionDAO.create({ id: uuidv4(), userId: req.user.id, type: 'expense', amount: finalPrice, description: `一口价购买《${auction.title}》`, auctionId: auction.id, createdAt: Date.now() });
    AuctionDAO.update(auction);
  } else {
    processProxyBids(auction, req.user.id);
  }

  const latestUser = UserDAO.getById(req.user.id);
  const bidderInfo = {
    id: result.bid.id,
    auctionId: result.bid.auctionId,
    userId: result.bid.userId,
    nickname: latestUser.nickname,
    avatar: latestUser.avatar,
    price: result.bid.price,
    time: result.bid.time
  };

  io.emit('bid:new', { ...bidderInfo, auctionEndTime: auction.endTime, delayCount: auction.delayCount });
  notifyBidWatchers(auction, finalPrice, latestUser, req.user.id);

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

app.get('/api/auctions/:id/proxy', authMiddleware, (req, res) => {
  const proxy = ProxyBidDAO.getByUserAndAuction(req.user.id, req.params.id);
  res.json(proxy || null);
});

app.post('/api/auctions/:id/proxy', authMiddleware, (req, res) => {
  const auction = AuctionDAO.getById(req.params.id);
  if (!auction) return res.status(404).json({ error: '拍品不存在' });
  const status = getAuctionStatus(auction);
  if (status === 'ended') return res.status(400).json({ error: '拍卖已结束' });
  if (auction.sellerId === req.user.id) return res.status(400).json({ error: '不能对自己的拍品设置代理出价' });

  const { maxPrice } = req.body;
  if (!maxPrice || maxPrice <= auction.currentPrice) {
    return res.status(400).json({ error: `代理出价上限必须高于当前价 ${auction.currentPrice}` });
  }
  const user = UserDAO.getById(req.user.id);
  if (!user || user.balance < maxPrice) return res.status(400).json({ error: '余额不足以设置此代理上限' });

  const existing = ProxyBidDAO.getByUserAndAuction(req.user.id, req.params.id);
  if (existing) {
    ProxyBidDAO.cancel(existing.id);
  }

  const pb = {
    id: uuidv4(),
    auctionId: req.params.id,
    userId: req.user.id,
    maxPrice,
    status: 'active',
    createdAt: Date.now()
  };
  ProxyBidDAO.create(pb);

  processProxyBids(auction, req.user.id);

  res.json(pb);
});

app.delete('/api/auctions/:id/proxy', authMiddleware, (req, res) => {
  const proxy = ProxyBidDAO.getByUserAndAuction(req.user.id, req.params.id);
  if (!proxy) return res.status(404).json({ error: '未找到代理出价' });
  ProxyBidDAO.cancel(proxy.id);
  res.json({ success: true });
});

app.get('/api/my/proxy-bids', authMiddleware, (req, res) => {
  const list = ProxyBidDAO.getByUser(req.user.id);
  const result = list.map(p => {
    const auction = AuctionDAO.getById(p.auctionId);
    if (auction) getAuctionStatus(auction);
    return { ...p, auction };
  });
  res.json(result);
});

app.get('/api/specials', (req, res) => {
  const list = AuctionSpecialDAO.getAll();
  const result = list.map(sp => {
    const auctions = AuctionDAO.getBySpecial(sp.id);
    auctions.forEach(a => getAuctionStatus(a));
    const activeCount = auctions.filter(a => a.status === 'active').length;
    return { ...sp, auctionCount: auctions.length, activeCount };
  });
  res.json(result);
});

app.get('/api/specials/:id', (req, res) => {
  const sp = AuctionSpecialDAO.getById(req.params.id);
  if (!sp) return res.status(404).json({ error: '专场不存在' });
  const auctions = AuctionDAO.getBySpecial(req.params.id);
  auctions.forEach(a => getAuctionStatus(a));
  const enriched = auctions.map(a => {
    const seller = UserDAO.getById(a.sellerId);
    const cert = CertificationDAO.getByAuction(a.id);
    return {
      ...a,
      sellerNickname: seller ? seller.nickname : '未知',
      sellerAvatar: seller ? seller.avatar : '',
      sellerCreditScore: seller ? seller.creditScore : 5,
      hasCertification: !!cert
    };
  });
  res.json({ ...sp, auctions: enriched });
});

app.post('/api/specials', authMiddleware, (req, res) => {
  const { name, description, coverImage, startTime, endTime } = req.body;
  if (!name || !startTime || !endTime) {
    return res.status(400).json({ error: '请填写完整信息' });
  }
  const sp = {
    id: uuidv4(),
    name,
    description,
    coverImage,
    startTime,
    endTime,
    createdBy: req.user.id,
    createdAt: Date.now()
  };
  AuctionSpecialDAO.create(sp);
  io.emit('special:new', sp);
  res.json(sp);
});

app.put('/api/specials/:id', authMiddleware, (req, res) => {
  const sp = AuctionSpecialDAO.getById(req.params.id);
  if (!sp) return res.status(404).json({ error: '专场不存在' });
  const { name, description, coverImage, startTime, endTime } = req.body;
  sp.name = name || sp.name;
  sp.description = description || sp.description;
  sp.coverImage = coverImage || sp.coverImage;
  sp.startTime = startTime || sp.startTime;
  sp.endTime = endTime || sp.endTime;
  AuctionSpecialDAO.update(sp);
  res.json(sp);
});

app.post('/api/auctions/:id/reminder', authMiddleware, (req, res) => {
  const auction = AuctionDAO.getById(req.params.id);
  if (!auction) return res.status(404).json({ error: '拍品不存在' });
  const status = getAuctionStatus(auction);
  if (status === 'active' || status === 'ended') {
    return res.status(400).json({ error: '仅可对未开拍的拍品设置提醒' });
  }
  let set;
  if (ReminderDAO.has(req.user.id, req.params.id)) {
    ReminderDAO.remove(req.user.id, req.params.id);
    set = false;
  } else {
    ReminderDAO.create({
      id: uuidv4(),
      userId: req.user.id,
      auctionId: req.params.id,
      createdAt: Date.now(),
      notified: 0
    });
    set = true;
  }
  res.json({ set });
});

app.get('/api/my/reminders', authMiddleware, (req, res) => {
  const list = ReminderDAO.getByUser(req.user.id);
  const result = list.map(r => {
    const auction = AuctionDAO.getById(r.auctionId);
    if (auction) getAuctionStatus(auction);
    return { ...r, auction };
  });
  res.json(result);
});

app.get('/api/my/reminder-ids', authMiddleware, (req, res) => {
  const list = ReminderDAO.getByUser(req.user.id);
  res.json(list.map(r => r.auctionId));
});

app.get('/api/notifications', authMiddleware, (req, res) => {
  const list = NotificationDAO.getByUser(req.user.id);
  res.json(list);
});

app.post('/api/notifications/read-all', authMiddleware, (req, res) => {
  NotificationDAO.markAllRead(req.user.id);
  res.json({ success: true });
});

app.get('/api/notifications/unread-count', authMiddleware, (req, res) => {
  const count = NotificationDAO.getUnreadCount(req.user.id);
  res.json({ count });
});

app.get('/api/auctions-preview', (req, res) => {
  let list = AuctionDAO.getAll();
  list = list.map(a => {
    const status = getAuctionStatus(a);
    return { ...a, status };
  }).filter(a => a.status === 'preview' || a.status === 'upcoming')
    .sort((a, b) => a.startTime - b.startTime);
  const result = list.map(a => {
    const seller = UserDAO.getById(a.sellerId);
    const cert = CertificationDAO.getByAuction(a.id);
    return {
      ...a,
      sellerNickname: seller ? seller.nickname : '未知',
      sellerAvatar: seller ? seller.avatar : '',
      sellerCreditScore: seller ? seller.creditScore : 5,
      hasCertification: !!cert
    };
  });
  res.json(result);
});

const checkAuctionStart = () => {
  const now = Date.now();
  AuctionDAO.getAll().forEach(a => {
    const status = getAuctionStatus(a);
    if (status === 'active' && a.status !== 'active') {
      a.status = 'active';
      AuctionDAO.update(a);
      const reminders = ReminderDAO.getByAuction(a.id);
      reminders.forEach(r => {
        const notif = {
          id: uuidv4(),
          userId: r.userId,
          type: 'auction_start',
          title: '拍品已开拍',
          content: `《${a.title}》已经开始拍卖，快去出价吧！`,
          auctionId: a.id,
          read: 0,
          createdAt: now
        };
        NotificationDAO.create(notif);
        const sockets = Array.from(socketUsers.entries())
          .filter(([_, u]) => u && u.userId === r.userId)
          .map(([sid]) => sid);
        sockets.forEach(sid => {
          io.to(sid).emit('auction:started', {
            auctionId: a.id,
            auctionTitle: a.title,
            message: '您关注的拍品已经开拍！'
          });
        });
      });
      ReminderDAO.markNotified(a.id);
    }
  });
};
setInterval(checkAuctionStart, 5000);

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

app.post('/api/auctions/:id/favorite', authMiddleware, (req, res) => {
  const auctionId = req.params.id;
  const userId = req.user.id;
  let favorited;
  if (FavoriteDAO.has(userId, auctionId)) {
    FavoriteDAO.remove(userId, auctionId);
    favorited = false;
  } else {
    FavoriteDAO.add(userId, auctionId);
    favorited = true;
  }
  const auction = AuctionDAO.getById(auctionId);
  if (auction) {
    auction.favoriteCount = Math.max(0, auction.favoriteCount + (favorited ? 1 : -1));
    AuctionDAO.update(auction);
  }
  res.json({ favorited });
});

app.get('/api/favorites', authMiddleware, (req, res) => {
  const list = FavoriteDAO.getByUser(req.user.id);
  res.json(list);
});

app.get('/api/users/:id/reviews', (req, res) => {
  const userId = req.params.id;
  const reviews = ReviewDAO.getByUser(userId).map(r => {
    const reviewer = UserDAO.getById(r.reviewerId);
    const auction = AuctionDAO.getById(r.auctionId);
    return {
      ...r,
      reviewerNickname: reviewer ? reviewer.nickname : '未知',
      reviewerAvatar: reviewer ? reviewer.avatar : '',
      auctionTitle: auction ? auction.title : '未知'
    };
  });
  const avgRating = ReviewDAO.getAverageRating(userId);
  res.json({ reviews, avgRating });
});

app.post('/api/auctions/:id/review', authMiddleware, (req, res) => {
  const auctionId = req.params.id;
  const auction = AuctionDAO.getById(auctionId);
  if (!auction || auction.status !== 'ended') {
    return res.status(400).json({ error: '拍卖未结束' });
  }
  const { rating, comment, targetRole } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: '评分无效' });
  }
  let revieweeId;
  let role;
  if (req.user.id === auction.sellerId) {
    if (targetRole !== 'buyer' || !auction.winnerId) {
      return res.status(400).json({ error: '评价对象无效' });
    }
    revieweeId = auction.winnerId;
    role = 'seller';
  } else if (req.user.id === auction.winnerId) {
    if (targetRole !== 'seller') {
      return res.status(400).json({ error: '评价对象无效' });
    }
    revieweeId = auction.sellerId;
    role = 'buyer';
  } else {
    return res.status(403).json({ error: '无权评价' });
  }
  if (ReviewDAO.hasReviewed(auctionId, req.user.id)) {
    return res.status(400).json({ error: '已评价过此拍卖' });
  }
  const review = {
    id: uuidv4(),
    auctionId,
    reviewerId: req.user.id,
    revieweeId,
    rating,
    comment: comment || '',
    role,
    createdAt: Date.now()
  };
  ReviewDAO.create(review);
  calcCreditScore(revieweeId);
  res.json(review);
});

app.get('/api/auctions/:id/review-status', authMiddleware, (req, res) => {
  const auctionId = req.params.id;
  const auction = AuctionDAO.getById(auctionId);
  if (!auction) return res.status(404).json({ error: '拍品不存在' });
  const existing = ReviewDAO.getByAuction(auctionId);
  let canReviewSeller = false;
  let canReviewBuyer = false;
  let reviewedSeller = false;
  let reviewedBuyer = false;
  if (auction.status === 'ended') {
    if (req.user.id === auction.winnerId) {
      canReviewSeller = true;
      reviewedSeller = existing.some(r => r.reviewerId === req.user.id && r.role === 'buyer');
    }
    if (req.user.id === auction.sellerId && auction.winnerId) {
      canReviewBuyer = true;
      reviewedBuyer = existing.some(r => r.reviewerId === req.user.id && r.role === 'seller');
    }
  }
  res.json({ canReviewSeller, canReviewBuyer, reviewedSeller, reviewedBuyer, reviews: existing });
});

app.post('/api/reports', authMiddleware, (req, res) => {
  const { targetId, targetType, auctionId, reason, description } = req.body;
  if (!targetId || !targetType || !reason) {
    return res.status(400).json({ error: '请填写完整举报信息' });
  }
  const report = {
    id: uuidv4(),
    reporterId: req.user.id,
    targetId,
    targetType,
    auctionId: auctionId || null,
    reason,
    description: description || '',
    status: 'pending',
    createdAt: Date.now()
  };
  ReportDAO.create(report);
  if (targetType === 'user') {
    const target = UserDAO.getById(targetId);
    if (target) {
      const newScore = Math.max(0, (target.creditScore || 5) - 0.5);
      UserDAO.updateCreditScore(targetId, newScore);
    }
  }
  res.json({ success: true });
});

app.get('/api/users/:id/credit', (req, res) => {
  const user = UserDAO.getById(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const avg = ReviewDAO.getAverageRating(req.params.id);
  res.json({ creditScore: user.creditScore, avgRating: avg });
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
