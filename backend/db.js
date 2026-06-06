const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'auction.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT NOT NULL,
      avatar TEXT,
      balance REAL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auctions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      images TEXT,
      category TEXT,
      start_price REAL NOT NULL,
      min_increment REAL NOT NULL,
      deposit REAL NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      buy_now_price REAL,
      seller_id TEXT NOT NULL,
      current_price REAL NOT NULL,
      bid_count INTEGER DEFAULT 0,
      watcher_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      winner_id TEXT,
      final_price REAL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      auction_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      price REAL NOT NULL,
      time INTEGER NOT NULL,
      FOREIGN KEY (auction_id) REFERENCES auctions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      auction_id TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      auction_id TEXT NOT NULL,
      UNIQUE(user_id, auction_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (auction_id) REFERENCES auctions(id)
    );
  `);
};

const passwordHash = (password) => bcrypt.hashSync(password, 10);

const rowToUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    nickname: row.nickname,
    avatar: row.avatar,
    balance: row.balance,
    createdAt: row.created_at
  };
};

const rowToAuction = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    images: row.images ? JSON.parse(row.images) : [],
    category: row.category,
    startPrice: row.start_price,
    minIncrement: row.min_increment,
    deposit: row.deposit,
    startTime: row.start_time,
    endTime: row.end_time,
    buyNowPrice: row.buy_now_price,
    sellerId: row.seller_id,
    currentPrice: row.current_price,
    bidCount: row.bid_count,
    watcherCount: row.watcher_count,
    status: row.status,
    winnerId: row.winner_id,
    finalPrice: row.final_price,
    createdAt: row.created_at
  };
};

const rowToBid = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    auctionId: row.auction_id,
    userId: row.user_id,
    price: row.price,
    time: row.time
  };
};

const rowToTransaction = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    description: row.description,
    auctionId: row.auction_id,
    createdAt: row.created_at
  };
};

const UserDAO = {
  getAll: () => db.prepare('SELECT * FROM users').all().map(rowToUser),
  getById: (id) => rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)),
  getByUsername: (username) => rowToUser(db.prepare('SELECT * FROM users WHERE username = ?').get(username)),
  create: (user) => {
    db.prepare(`INSERT INTO users (id, username, password, nickname, avatar, balance, created_at)
                VALUES (@id, @username, @password, @nickname, @avatar, @balance, @createdAt)`).run(user);
    return user;
  },
  updateBalance: (id, balance) => {
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(balance, id);
  }
};

const AuctionDAO = {
  getAll: () => db.prepare('SELECT * FROM auctions ORDER BY created_at DESC').all().map(rowToAuction),
  getById: (id) => rowToAuction(db.prepare('SELECT * FROM auctions WHERE id = ?').get(id)),
  create: (auction) => {
    const params = {
      id: auction.id,
      title: auction.title,
      description: auction.description || null,
      images: JSON.stringify(auction.images || []),
      category: auction.category || null,
      startPrice: auction.startPrice,
      minIncrement: auction.minIncrement,
      deposit: auction.deposit,
      startTime: auction.startTime,
      endTime: auction.endTime,
      buyNowPrice: auction.buyNowPrice || null,
      sellerId: auction.sellerId,
      currentPrice: auction.currentPrice,
      bidCount: auction.bidCount || 0,
      watcherCount: auction.watcherCount || 0,
      status: auction.status || 'pending',
      winnerId: auction.winnerId || null,
      finalPrice: auction.finalPrice || null,
      createdAt: auction.createdAt
    };
    db.prepare(`INSERT INTO auctions (id, title, description, images, category, start_price, min_increment,
                deposit, start_time, end_time, buy_now_price, seller_id, current_price, bid_count,
                watcher_count, status, winner_id, final_price, created_at)
                VALUES (@id, @title, @description, @images, @category, @startPrice, @minIncrement,
                @deposit, @startTime, @endTime, @buyNowPrice, @sellerId, @currentPrice, @bidCount,
                @watcherCount, @status, @winnerId, @finalPrice, @createdAt)`).run(params);
    return auction;
  },
  update: (auction) => {
    const params = {
      id: auction.id,
      title: auction.title,
      description: auction.description || null,
      images: JSON.stringify(auction.images || []),
      category: auction.category || null,
      startPrice: auction.startPrice,
      minIncrement: auction.minIncrement,
      deposit: auction.deposit,
      startTime: auction.startTime,
      endTime: auction.endTime,
      buyNowPrice: auction.buyNowPrice || null,
      currentPrice: auction.currentPrice,
      bidCount: auction.bidCount || 0,
      watcherCount: auction.watcherCount || 0,
      status: auction.status || 'pending',
      winnerId: auction.winnerId || null,
      finalPrice: auction.finalPrice || null
    };
    db.prepare(`UPDATE auctions SET title=@title, description=@description, images=@images,
                category=@category, start_price=@startPrice, min_increment=@minIncrement,
                deposit=@deposit, start_time=@startTime, end_time=@endTime, buy_now_price=@buyNowPrice,
                current_price=@currentPrice, bid_count=@bidCount, watcher_count=@watcherCount,
                status=@status, winner_id=@winnerId, final_price=@finalPrice WHERE id=@id`).run(params);
  }
};

const BidDAO = {
  getAll: () => db.prepare('SELECT * FROM bids ORDER BY time DESC').all().map(rowToBid),
  getByAuction: (auctionId) =>
    db.prepare('SELECT * FROM bids WHERE auction_id = ? ORDER BY time DESC').all(auctionId).map(rowToBid),
  getByUser: (userId) =>
    db.prepare('SELECT * FROM bids WHERE user_id = ? ORDER BY time DESC').all(userId).map(rowToBid),
  create: (bid) => {
    db.prepare(`INSERT INTO bids (id, auction_id, user_id, price, time)
                VALUES (@id, @auctionId, @userId, @price, @time)`).run(bid);
    return bid;
  }
};

const TransactionDAO = {
  getAll: () => db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all().map(rowToTransaction),
  getByUser: (userId) =>
    db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC').all(userId).map(rowToTransaction),
  create: (tx) => {
    const params = {
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      amount: tx.amount,
      description: tx.description || null,
      auctionId: tx.auctionId || null,
      createdAt: tx.createdAt
    };
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, description, auction_id, created_at)
                VALUES (@id, @userId, @type, @amount, @description, @auctionId, @createdAt)`).run(params);
    return tx;
  }
};

const WatchlistDAO = {
  getByUser: (userId) =>
    db.prepare('SELECT auction_id FROM watchlist WHERE user_id = ?').all(userId).map(r => r.auction_id),
  has: (userId, auctionId) =>
    !!db.prepare('SELECT 1 FROM watchlist WHERE user_id = ? AND auction_id = ?').get(userId, auctionId),
  add: (userId, auctionId) => {
    try {
      db.prepare('INSERT INTO watchlist (user_id, auction_id) VALUES (?, ?)').run(userId, auctionId);
      return true;
    } catch (e) { return false; }
  },
  remove: (userId, auctionId) => {
    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND auction_id = ?').run(userId, auctionId);
  }
};

const initMockData = () => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) return;

  const now = Date.now();
  const tx = db.transaction(() => {
    const mockUsers = [
      { id: 'user-admin', nickname: '管理员', username: 'admin', password: '123456', balance: 100000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin' },
      { id: 'user-1', nickname: '收藏家小王', username: 'buyer1', password: '123456', balance: 50000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer1' },
      { id: 'user-2', nickname: '艺术品爱好者', username: 'buyer2', password: '123456', balance: 80000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer2' },
      { id: 'user-3', nickname: '古董商老李', username: 'seller1', password: '123456', balance: 30000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=seller1' },
      { id: 'user-4', nickname: '时尚达人', username: 'seller2', password: '123456', balance: 45000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=seller2' },
      { id: 'user-5', nickname: '数码极客', username: 'buyer3', password: '123456', balance: 60000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer3' },
    ];
    mockUsers.forEach(u => {
      UserDAO.create({ ...u, password: passwordHash(u.password), createdAt: now });
    });

    const mockAuctions = [
      { id: 'auction-1', title: '清代青花瓷瓶', description: '<p>清乾隆时期官窑青花瓷瓶，保存完好，釉色温润，是收藏佳品。</p><p>高度约35cm，底部有乾隆年制款识。</p>', images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600'], category: '古董', startPrice: 50000, minIncrement: 1000, deposit: 5000, startTime: now - 3600000 * 2, endTime: now + 3600000 * 5, buyNowPrice: 120000, sellerId: 'user-3', status: 'active' },
      { id: 'auction-2', title: '齐白石水墨虾图', description: '<p>齐白石大师晚年作品，水墨写意虾图，灵动自然。</p><p>尺寸：68cm × 45cm，有多处收藏章。</p>', images: ['https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600'], category: '艺术品', startPrice: 80000, minIncrement: 2000, deposit: 8000, startTime: now - 3600000 * 5, endTime: now + 3600000 * 2, buyNowPrice: 200000, sellerId: 'user-3', status: 'active' },
      { id: 'auction-3', title: '限量版iPhone 15 Pro Max', description: '<p>钛金属原色，1TB版本，未拆封。</p><p>全球限量编号版，附带收藏证书。</p>', images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600'], category: '数码', startPrice: 15000, minIncrement: 500, deposit: 1500, startTime: now - 3600000, endTime: now + 3600000 * 24, buyNowPrice: 30000, sellerId: 'user-5', status: 'active' },
      { id: 'auction-4', title: '缅甸天然翡翠手镯', description: '<p>A货翡翠，冰种飘绿，内径58mm。</p><p>附带国家级珠宝鉴定证书。</p>', images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600'], category: '珠宝', startPrice: 30000, minIncrement: 1000, deposit: 3000, startTime: now - 3600000 * 10, endTime: now + 3600000 * 8, buyNowPrice: 88000, sellerId: 'user-4', status: 'active' },
      { id: 'auction-5', title: '爱马仕Birkin 30', description: '<p>经典Togo皮，黑色银扣，Y刻。</p><p>99新，全套配件齐全。</p>', images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600'], category: '奢侈品', startPrice: 100000, minIncrement: 5000, deposit: 10000, startTime: now - 3600000 * 24, endTime: now + 3600000 * 12, buyNowPrice: 180000, sellerId: 'user-4', status: 'active' },
      { id: 'auction-6', title: '1960年代劳力士潜航者', description: '<p> vintage Rolex Submariner 5513，原装表盘。</p><p>走时精准，收藏级品相。</p>', images: ['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600'], category: '收藏品', startPrice: 60000, minIncrement: 2000, deposit: 6000, startTime: now - 3600000 * 3, endTime: now + 3600000 * 6, buyNowPrice: 150000, sellerId: 'user-3', status: 'active' },
      { id: 'auction-7', title: '1959元年Fender Stratocaster', description: '<p>元年芬达电吉他，日落色，枫木指板。</p><p>原装拾音器，附带硬壳箱。</p>', images: ['https://images.unsplash.com/photo-1550985616-10810253b84d?w=600'], category: '乐器', startPrice: 150000, minIncrement: 5000, deposit: 15000, startTime: now - 3600000 * 48, endTime: now - 3600000 * 2, buyNowPrice: 280000, sellerId: 'user-5', status: 'ended', winnerId: 'user-1', finalPrice: 220000 },
      { id: 'auction-8', title: '宋版《资治通鉴》残卷', description: '<p>宋代刻本《资治通鉴》，存卷二十三至二十五。</p><p>名家递藏，藏印累累。</p>', images: ['https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600'], category: '稀有书籍', startPrice: 80000, minIncrement: 2000, deposit: 8000, startTime: now - 3600000 * 72, endTime: now - 3600000 * 5, buyNowPrice: 200000, sellerId: 'user-3', status: 'ended', winnerId: 'user-2', finalPrice: 165000 },
      { id: 'auction-9', title: '科比2010年总决赛签名球衣', description: '<p>科比·布莱恩特2010年总决赛G7亲笔签名球衣。</p><p>PSA/DNA认证，限量编号。</p>', images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600'], category: '运动纪念品', startPrice: 40000, minIncrement: 1000, deposit: 4000, startTime: now - 3600000 * 20, endTime: now + 3600000 * 4, buyNowPrice: 120000, sellerId: 'user-4', status: 'active' },
      { id: 'auction-10', title: 'Supreme Box Logo卫衣(2006)', description: '<p>2006年FW Box Logo Crewneck，灰色M码。</p><p>Deadstock状态，极稀有。</p>', images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600'], category: '时尚单品', startPrice: 8000, minIncrement: 200, deposit: 800, startTime: now - 3600000 * 1, endTime: now + 3600000 * 3, buyNowPrice: 25000, sellerId: 'user-5', status: 'active' }
    ];

    mockAuctions.forEach(a => {
      AuctionDAO.create({
        ...a,
        currentPrice: a.startPrice,
        bidCount: 0,
        watcherCount: Math.floor(Math.random() * 50) + 5,
        createdAt: now - 3600000 * 10
      });
    });

    const bidData = [
      { id: 'bid-1', auctionId: 'auction-1', userId: 'user-1', price: 51000, time: now - 3600000 * 1.5 },
      { id: 'bid-2', auctionId: 'auction-1', userId: 'user-2', price: 53000, time: now - 3600000 * 1.2 },
      { id: 'bid-3', auctionId: 'auction-1', userId: 'user-5', price: 56000, time: now - 3600000 * 0.8 },
      { id: 'bid-4', auctionId: 'auction-2', userId: 'user-1', price: 82000, time: now - 3600000 * 4 },
      { id: 'bid-5', auctionId: 'auction-2', userId: 'user-2', price: 86000, time: now - 3600000 * 3 },
      { id: 'bid-6', auctionId: 'auction-2', userId: 'user-1', price: 92000, time: now - 3600000 * 1.5 },
      { id: 'bid-7', auctionId: 'auction-3', userId: 'user-2', price: 15500, time: now - 3600000 * 0.5 },
      { id: 'bid-8', auctionId: 'auction-4', userId: 'user-1', price: 31000, time: now - 3600000 * 8 },
      { id: 'bid-9', auctionId: 'auction-4', userId: 'user-5', price: 33000, time: now - 3600000 * 6 },
      { id: 'bid-10', auctionId: 'auction-5', userId: 'user-2', price: 105000, time: now - 3600000 * 20 },
      { id: 'bid-11', auctionId: 'auction-5', userId: 'user-1', price: 115000, time: now - 3600000 * 10 },
      { id: 'bid-12', auctionId: 'auction-6', userId: 'user-2', price: 62000, time: now - 3600000 * 2 },
      { id: 'bid-13', auctionId: 'auction-7', userId: 'user-2', price: 160000, time: now - 3600000 * 46 },
      { id: 'bid-14', auctionId: 'auction-7', userId: 'user-1', price: 190000, time: now - 3600000 * 30 },
      { id: 'bid-15', auctionId: 'auction-7', userId: 'user-2', price: 210000, time: now - 3600000 * 15 },
      { id: 'bid-16', auctionId: 'auction-7', userId: 'user-1', price: 220000, time: now - 3600000 * 5 },
      { id: 'bid-17', auctionId: 'auction-8', userId: 'user-1', price: 85000, time: now - 3600000 * 70 },
      { id: 'bid-18', auctionId: 'auction-8', userId: 'user-2', price: 120000, time: now - 3600000 * 50 },
      { id: 'bid-19', auctionId: 'auction-8', userId: 'user-1', price: 145000, time: now - 3600000 * 30 },
      { id: 'bid-20', auctionId: 'auction-8', userId: 'user-2', price: 165000, time: now - 3600000 * 10 },
      { id: 'bid-21', auctionId: 'auction-9', userId: 'user-1', price: 41000, time: now - 3600000 * 15 },
      { id: 'bid-22', auctionId: 'auction-9', userId: 'user-5', price: 45000, time: now - 3600000 * 8 },
      { id: 'bid-23', auctionId: 'auction-10', userId: 'user-1', price: 8500, time: now - 3600000 * 0.3 }
    ];

    bidData.forEach(b => {
      BidDAO.create(b);
      const auction = AuctionDAO.getById(b.auctionId);
      if (auction) {
        auction.bidCount++;
        if (auction.status === 'active' && b.price > auction.currentPrice) {
          auction.currentPrice = b.price;
        }
        AuctionDAO.update(auction);
      }
    });

    WatchlistDAO.add('user-1', 'auction-1');
    WatchlistDAO.add('user-1', 'auction-2');
    WatchlistDAO.add('user-1', 'auction-4');
    WatchlistDAO.add('user-1', 'auction-6');
    WatchlistDAO.add('user-2', 'auction-3');
    WatchlistDAO.add('user-2', 'auction-5');
    WatchlistDAO.add('user-2', 'auction-9');
    WatchlistDAO.add('user-5', 'auction-1');
    WatchlistDAO.add('user-5', 'auction-10');

    const won7 = AuctionDAO.getById('auction-7');
    const seller7 = UserDAO.getById(won7.sellerId);
    const winner7 = UserDAO.getById(won7.winnerId);
    seller7.balance += won7.finalPrice;
    winner7.balance -= (won7.finalPrice - won7.deposit);
    UserDAO.updateBalance(seller7.id, seller7.balance);
    UserDAO.updateBalance(winner7.id, winner7.balance);
    TransactionDAO.create({ id: uuidv4(), userId: won7.sellerId, type: 'income', amount: won7.finalPrice, description: `出售《${won7.title}》成交`, auctionId: won7.id, createdAt: now });
    TransactionDAO.create({ id: uuidv4(), userId: won7.winnerId, type: 'expense', amount: won7.finalPrice, description: `拍得《${won7.title}》`, auctionId: won7.id, createdAt: now });

    const won8 = AuctionDAO.getById('auction-8');
    const seller8 = UserDAO.getById(won8.sellerId);
    const winner8 = UserDAO.getById(won8.winnerId);
    seller8.balance += won8.finalPrice;
    winner8.balance -= (won8.finalPrice - won8.deposit);
    UserDAO.updateBalance(seller8.id, seller8.balance);
    UserDAO.updateBalance(winner8.id, winner8.balance);
    TransactionDAO.create({ id: uuidv4(), userId: won8.sellerId, type: 'income', amount: won8.finalPrice, description: `出售《${won8.title}》成交`, auctionId: won8.id, createdAt: now });
    TransactionDAO.create({ id: uuidv4(), userId: won8.winnerId, type: 'expense', amount: won8.finalPrice, description: `拍得《${won8.title}》`, auctionId: won8.id, createdAt: now });
  });

  tx();
  console.log('Mock data initialized in SQLite');
};

initTables();
initMockData();

module.exports = {
  db,
  uuidv4,
  UserDAO,
  AuctionDAO,
  BidDAO,
  TransactionDAO,
  WatchlistDAO
};
