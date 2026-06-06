const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const users = new Map();
const auctions = new Map();
const bids = new Map();
const transactions = new Map();
const watchlist = new Map();

const passwordHash = (password) => bcrypt.hashSync(password, 10);

const initMockData = () => {
  const mockUsers = [
    { id: 'user-admin', nickname: '管理员', username: 'admin', password: '123456', balance: 100000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin' },
    { id: 'user-1', nickname: '收藏家小王', username: 'buyer1', password: '123456', balance: 50000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer1' },
    { id: 'user-2', nickname: '艺术品爱好者', username: 'buyer2', password: '123456', balance: 80000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer2' },
    { id: 'user-3', nickname: '古董商老李', username: 'seller1', password: '123456', balance: 30000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=seller1' },
    { id: 'user-4', nickname: '时尚达人', username: 'seller2', password: '123456', balance: 45000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=seller2' },
    { id: 'user-5', nickname: '数码极客', username: 'buyer3', password: '123456', balance: 60000, avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=buyer3' },
  ];

  mockUsers.forEach(u => {
    users.set(u.id, { ...u, password: passwordHash(u.password), createdAt: Date.now() });
  });

  const now = Date.now();
  const categories = ['古董', '艺术品', '数码', '珠宝', '奢侈品', '收藏品', '乐器', '稀有书籍', '运动纪念品', '时尚单品'];
  
  const mockAuctions = [
    {
      title: '清代青花瓷瓶',
      description: '<p>清乾隆时期官窑青花瓷瓶，保存完好，釉色温润，是收藏佳品。</p><p>高度约35cm，底部有乾隆年制款识。</p>',
      images: ['https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600'],
      category: '古董',
      startPrice: 50000,
      minIncrement: 1000,
      deposit: 5000,
      startTime: now - 3600000 * 2,
      endTime: now + 3600000 * 5,
      buyNowPrice: 120000,
      sellerId: 'user-3',
      status: 'active'
    },
    {
      title: '齐白石水墨虾图',
      description: '<p>齐白石大师晚年作品，水墨写意虾图，灵动自然。</p><p>尺寸：68cm × 45cm，有多处收藏章。</p>',
      images: ['https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600'],
      category: '艺术品',
      startPrice: 80000,
      minIncrement: 2000,
      deposit: 8000,
      startTime: now - 3600000 * 5,
      endTime: now + 3600000 * 2,
      buyNowPrice: 200000,
      sellerId: 'user-3',
      status: 'active'
    },
    {
      title: '限量版iPhone 15 Pro Max',
      description: '<p>钛金属原色，1TB版本，未拆封。</p><p>全球限量编号版，附带收藏证书。</p>',
      images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600'],
      category: '数码',
      startPrice: 15000,
      minIncrement: 500,
      deposit: 1500,
      startTime: now - 3600000,
      endTime: now + 3600000 * 24,
      buyNowPrice: 30000,
      sellerId: 'user-5',
      status: 'active'
    },
    {
      title: '缅甸天然翡翠手镯',
      description: '<p>A货翡翠，冰种飘绿，内径58mm。</p><p>附带国家级珠宝鉴定证书。</p>',
      images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600'],
      category: '珠宝',
      startPrice: 30000,
      minIncrement: 1000,
      deposit: 3000,
      startTime: now - 3600000 * 10,
      endTime: now + 3600000 * 8,
      buyNowPrice: 88000,
      sellerId: 'user-4',
      status: 'active'
    },
    {
      title: '爱马仕Birkin 30',
      description: '<p>经典Togo皮，黑色银扣，Y刻。</p><p>99新，全套配件齐全。</p>',
      images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600'],
      category: '奢侈品',
      startPrice: 100000,
      minIncrement: 5000,
      deposit: 10000,
      startTime: now - 3600000 * 24,
      endTime: now + 3600000 * 12,
      buyNowPrice: 180000,
      sellerId: 'user-4',
      status: 'active'
    },
    {
      title: '1960年代劳力士潜航者',
      description: '<p> vintage Rolex Submariner 5513，原装表盘。</p><p>走时精准，收藏级品相。</p>',
      images: ['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600'],
      category: '收藏品',
      startPrice: 60000,
      minIncrement: 2000,
      deposit: 6000,
      startTime: now - 3600000 * 3,
      endTime: now + 3600000 * 6,
      buyNowPrice: 150000,
      sellerId: 'user-3',
      status: 'active'
    },
    {
      title: '1959元年Fender Stratocaster',
      description: '<p>元年芬达电吉他，日落色，枫木指板。</p><p>原装拾音器，附带硬壳箱。</p>',
      images: ['https://images.unsplash.com/photo-1550985616-10810253b84d?w=600'],
      category: '乐器',
      startPrice: 150000,
      minIncrement: 5000,
      deposit: 15000,
      startTime: now - 3600000 * 48,
      endTime: now - 3600000 * 2,
      buyNowPrice: 280000,
      sellerId: 'user-5',
      status: 'ended',
      winnerId: 'user-1',
      finalPrice: 220000
    },
    {
      title: '宋版《资治通鉴》残卷',
      description: '<p>宋代刻本《资治通鉴》，存卷二十三至二十五。</p><p>名家递藏，藏印累累。</p>',
      images: ['https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600'],
      category: '稀有书籍',
      startPrice: 80000,
      minIncrement: 2000,
      deposit: 8000,
      startTime: now - 3600000 * 72,
      endTime: now - 3600000 * 5,
      buyNowPrice: 200000,
      sellerId: 'user-3',
      status: 'ended',
      winnerId: 'user-2',
      finalPrice: 165000
    },
    {
      title: '科比2010年总决赛签名球衣',
      description: '<p>科比·布莱恩特2010年总决赛G7亲笔签名球衣。</p><p>PSA/DNA认证，限量编号。</p>',
      images: ['https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600'],
      category: '运动纪念品',
      startPrice: 40000,
      minIncrement: 1000,
      deposit: 4000,
      startTime: now - 3600000 * 20,
      endTime: now + 3600000 * 4,
      buyNowPrice: 120000,
      sellerId: 'user-4',
      status: 'active'
    },
    {
      title: 'Supreme Box Logo卫衣(2006)',
      description: '<p>2006年FW Box Logo Crewneck，灰色M码。</p><p>Deadstock状态，极稀有。</p>',
      images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600'],
      category: '时尚单品',
      startPrice: 8000,
      minIncrement: 200,
      deposit: 800,
      startTime: now - 3600000 * 1,
      endTime: now + 3600000 * 3,
      buyNowPrice: 25000,
      sellerId: 'user-5',
      status: 'active'
    }
  ];

  mockAuctions.forEach((auction, idx) => {
    const id = 'auction-' + (idx + 1);
    auctions.set(id, {
      id,
      ...auction,
      currentPrice: auction.startPrice,
      bidCount: 0,
      watcherCount: Math.floor(Math.random() * 50) + 5,
      createdAt: now - 3600000 * (idx + 10)
    });
  });

  const endedAuction1 = auctions.get('auction-7');
  const endedAuction2 = auctions.get('auction-8');

  const bidData = [
    { auctionId: 'auction-1', userId: 'user-1', price: 51000, time: now - 3600000 * 1.5 },
    { auctionId: 'auction-1', userId: 'user-2', price: 53000, time: now - 3600000 * 1.2 },
    { auctionId: 'auction-1', userId: 'user-5', price: 56000, time: now - 3600000 * 0.8 },
    { auctionId: 'auction-2', userId: 'user-1', price: 82000, time: now - 3600000 * 4 },
    { auctionId: 'auction-2', userId: 'user-2', price: 86000, time: now - 3600000 * 3 },
    { auctionId: 'auction-2', userId: 'user-1', price: 92000, time: now - 3600000 * 1.5 },
    { auctionId: 'auction-3', userId: 'user-2', price: 15500, time: now - 3600000 * 0.5 },
    { auctionId: 'auction-4', userId: 'user-1', price: 31000, time: now - 3600000 * 8 },
    { auctionId: 'auction-4', userId: 'user-5', price: 33000, time: now - 3600000 * 6 },
    { auctionId: 'auction-5', userId: 'user-2', price: 105000, time: now - 3600000 * 20 },
    { auctionId: 'auction-5', userId: 'user-1', price: 115000, time: now - 3600000 * 10 },
    { auctionId: 'auction-6', userId: 'user-2', price: 62000, time: now - 3600000 * 2 },
    { auctionId: 'auction-7', userId: 'user-2', price: 160000, time: now - 3600000 * 46 },
    { auctionId: 'auction-7', userId: 'user-1', price: 190000, time: now - 3600000 * 30 },
    { auctionId: 'auction-7', userId: 'user-2', price: 210000, time: now - 3600000 * 15 },
    { auctionId: 'auction-7', userId: 'user-1', price: 220000, time: now - 3600000 * 5 },
    { auctionId: 'auction-8', userId: 'user-1', price: 85000, time: now - 3600000 * 70 },
    { auctionId: 'auction-8', userId: 'user-2', price: 120000, time: now - 3600000 * 50 },
    { auctionId: 'auction-8', userId: 'user-1', price: 145000, time: now - 3600000 * 30 },
    { auctionId: 'auction-8', userId: 'user-2', price: 165000, time: now - 3600000 * 10 },
    { auctionId: 'auction-9', userId: 'user-1', price: 41000, time: now - 3600000 * 15 },
    { auctionId: 'auction-9', userId: 'user-5', price: 45000, time: now - 3600000 * 8 },
    { auctionId: 'auction-10', userId: 'user-1', price: 8500, time: now - 3600000 * 0.3 },
  ];

  bidData.forEach((b, idx) => {
    const bidId = 'bid-' + (idx + 1);
    bids.set(bidId, { id: bidId, ...b });
    const auction = auctions.get(b.auctionId);
    if (auction) {
      auction.bidCount++;
      if (auction.status === 'active' && b.price > auction.currentPrice) {
        auction.currentPrice = b.price;
      }
    }
  });

  watchlist.set('user-1', ['auction-1', 'auction-2', 'auction-4', 'auction-6']);
  watchlist.set('user-2', ['auction-3', 'auction-5', 'auction-9']);
  watchlist.set('user-5', ['auction-1', 'auction-10']);
};

module.exports = {
  users,
  auctions,
  bids,
  transactions,
  watchlist,
  initMockData,
  uuidv4
};
