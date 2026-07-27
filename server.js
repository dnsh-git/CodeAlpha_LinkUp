const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, dbState } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect Database
connectDB();

// API: Get All Users
app.get('/api/users', (req, res) => {
  const safeUsers = dbState.users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    bio: u.bio,
    followersCount: u.followers.length,
    followingCount: u.following.length
  }));
  res.json(safeUsers);
});

// API: Get Single User Profile
app.get('/api/users/:username', (req, res) => {
  const user = dbState.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });

  const userPosts = dbState.posts.filter(p => p.username.toLowerCase() === user.username.toLowerCase());

  res.json({
    ...user,
    followersCount: user.followers.length,
    followingCount: user.following.length,
    postsCount: userPosts.length,
    posts: userPosts
  });
});

// API: Toggle Follow / Unfollow User
app.post('/api/users/:username/follow', (req, res) => {
  const { currentUserId } = req.body;
  const targetUser = dbState.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  const currentUser = dbState.users.find(u => u.id === currentUserId);

  if (!targetUser || !currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (targetUser.id === currentUser.id) {
    return res.status(400).json({ error: 'You cannot follow yourself' });
  }

  const isFollowing = targetUser.followers.includes(currentUser.id);

  if (isFollowing) {
    // Unfollow
    targetUser.followers = targetUser.followers.filter(id => id !== currentUser.id);
    currentUser.following = currentUser.following.filter(id => id !== targetUser.id);
  } else {
    // Follow
    targetUser.followers.push(currentUser.id);
    currentUser.following.push(targetUser.id);
  }

  res.json({
    isFollowing: !isFollowing,
    followersCount: targetUser.followers.length,
    followingCount: targetUser.following.length,
    message: !isFollowing ? `Now following @${targetUser.username}` : `Unfollowed @${targetUser.username}`
  });
});

// API: Get Posts (Feed / Filter)
app.get('/api/posts', (req, res) => {
  let list = [...dbState.posts];
  const { feed, username } = req.query;

  if (username) {
    list = list.filter(p => p.username.toLowerCase() === username.toLowerCase());
  } else if (feed === 'following') {
    // Current user following posts (demo: Alex Rivera following u2, u3)
    const activeUser = dbState.users[0]; // Default Alex
    list = list.filter(p => activeUser.following.includes(p.userId) || p.userId === activeUser.id);
  } else if (feed === 'trending') {
    list.sort((a, b) => b.likes.length - a.likes.length);
  }

  res.json(list);
});

// API: Create Post
app.post('/api/posts', (req, res) => {
  const { content, image, userId } = req.body;
  if (!content && !image) {
    return res.status(400).json({ error: 'Post must contain text or an image.' });
  }

  const author = dbState.users.find(u => u.id === userId) || dbState.users[0];

  const newPost = {
    id: 'post_' + Date.now(),
    userId: author.id,
    username: author.username,
    name: author.name,
    avatar: author.avatar,
    content: content || '',
    image: image || null,
    likes: [],
    comments: [],
    createdAt: 'Just now'
  };

  dbState.posts.unshift(newPost);

  res.status(201).json({
    message: 'Post created successfully!',
    post: newPost
  });
});

// API: Toggle Like on Post
app.post('/api/posts/:id/like', (req, res) => {
  const { userId } = req.body;
  const post = dbState.posts.find(p => p.id === req.params.id);

  if (!post) return res.status(404).json({ error: 'Post not found' });

  const activeUserId = userId || 'u1';
  const index = post.likes.indexOf(activeUserId);
  let isLiked = false;

  if (index > -1) {
    post.likes.splice(index, 1);
    isLiked = false;
  } else {
    post.likes.push(activeUserId);
    isLiked = true;
  }

  res.json({
    isLiked,
    likesCount: post.likes.length
  });
});

// API: Add Comment to Post
app.post('/api/posts/:id/comments', (req, res) => {
  const { text, userId } = req.body;
  if (!text) return res.status(400).json({ error: 'Comment text is required.' });

  const post = dbState.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const author = dbState.users.find(u => u.id === userId) || dbState.users[0];

  const newComment = {
    id: 'c_' + Date.now(),
    userId: author.id,
    username: author.username,
    name: author.name,
    avatar: author.avatar,
    text,
    createdAt: 'Just now'
  };

  post.comments.push(newComment);

  res.status(201).json({
    message: 'Comment added!',
    comment: newComment,
    commentsCount: post.comments.length
  });
});

// API: Delete Post
app.delete('/api/posts/:id', (req, res) => {
  const postIndex = dbState.posts.findIndex(p => p.id === req.params.id);
  if (postIndex === -1) return res.status(404).json({ error: 'Post not found' });

  dbState.posts.splice(postIndex, 1);
  res.json({ message: 'Post deleted successfully!' });
});

// API: Auth Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = dbState.users.find(u => u.username.toLowerCase() === email.split('@')[0].toLowerCase() || u.id === 'u1') || dbState.users[0];

  res.json({
    message: `Welcome back, @${user.username}!`,
    user
  });
});

// API: Auth Register
app.post('/api/auth/register', (req, res) => {
  const { name, username, bio } = req.body;
  const newUser = {
    id: 'u_' + Date.now(),
    username: username || 'user_' + Math.floor(Math.random() * 1000),
    name: name || 'New User',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    bio: bio || 'Building the future of social networking.',
    followers: [],
    following: ['u1', 'u2'],
    joined: 'Just now'
  };

  dbState.users.push(newUser);
  res.status(201).json({
    message: 'Profile created successfully!',
    user: newUser
  });
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`[LINKUP SERVER] 🚀 Running on http://localhost:${PORT}`);
});
