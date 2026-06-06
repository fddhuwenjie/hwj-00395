const jwt = require('jsonwebtoken');

const JWT_SECRET = 'auction-secret-key-2024';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
};

const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
};

module.exports = { generateToken, authMiddleware, verifySocketToken, JWT_SECRET };
