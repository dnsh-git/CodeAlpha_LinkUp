// LinkUp Application State
const state = {
  currentUser: {
    id: 'u1',
    username: 'alexrivera',
    name: 'Alex Rivera',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    following: ['u2', 'u3'],
    followers: ['u2', 'u3', 'u4']
  },
  posts: [],
  users: [],
  feed: 'all',
  search: '',
  selectedImg: null
};

// DOM Elements
const postsStream = document.getElementById('posts-stream');
const emptyFeed = document.getElementById('empty-feed');
const composerInput = document.getElementById('composer-input');
const publishPostBtn = document.getElementById('publish-post-btn');
const mediaFileInput = document.getElementById('media-file-input');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  loadPosts();
  loadSuggestedUsers();
  updateUserBadge();
});

// Toast Helper
function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
  div.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}

// Load Posts Feed
async function loadPosts() {
  try {
    postsStream.innerHTML = '<div class="empty-state">Loading updates...</div>';
    const params = new URLSearchParams();
    if (state.feed !== 'all') params.append('feed', state.feed);
    if (state.search) params.append('q', state.search);

    const res = await fetch(`/api/posts?${params.toString()}`);
    state.posts = await res.json();
    renderPosts();
  } catch (err) {
    postsStream.innerHTML = '<div class="empty-state">Failed to load feed. Ensure server is running.</div>';
  }
}

// Render Feed Posts
function renderPosts() {
  if (!state.posts.length) {
    postsStream.innerHTML = '';
    emptyFeed.classList.remove('hidden');
    return;
  }
  emptyFeed.classList.add('hidden');

  postsStream.innerHTML = state.posts.map(p => {
    const isLiked = p.likes.includes(state.currentUser.id);
    const isAuthor = p.userId === state.currentUser.id;

    return `
      <div class="post-card" data-id="${p.id}">
        <div class="post-header">
          <div class="post-author" onclick="viewUserProfile('${p.username}')">
            <img src="${p.avatar}" alt="${p.name}" class="avatar-sm">
            <div>
              <span class="post-author-name">${p.name}</span>
              <span class="post-author-user">@${p.username}</span>
            </div>
          </div>
          <span class="post-time">${p.createdAt}</span>
        </div>

        <div class="post-content">${escapeHTML(p.content)}</div>

        ${p.image ? `<img src="${p.image}" class="post-media" loading="lazy">` : ''}

        <div class="post-actions">
          <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${p.id}')">
            <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
            <span>${p.likes.length}</span>
          </button>

          <button class="action-btn" onclick="toggleCommentDrawer('${p.id}')">
            <i class="fa-regular fa-comment"></i>
            <span>${p.comments.length}</span>
          </button>

          <button class="action-btn" onclick="sharePost('${p.id}')">
            <i class="fa-regular fa-paper-plane"></i>
          </button>

          ${isAuthor ? `
            <button class="action-btn delete-post-btn" onclick="deletePost('${p.id}')" title="Delete Post">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>

        <!-- Comments Section -->
        <div id="comments-${p.id}" class="comments-section hidden">
          <div class="comments-list">
            ${(p.comments || []).map(c => `
              <div class="comment-item">
                <img src="${c.avatar}" class="avatar-sm">
                <div class="comment-content">
                  <div class="comment-author">${c.name} <span style="font-weight:400; color:var(--text-dim); font-size:0.75rem;">@${c.username} &bull; ${c.createdAt}</span></div>
                  <div class="comment-text">${escapeHTML(c.text)}</div>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="comment-input-box">
            <input type="text" id="comment-input-${p.id}" placeholder="Write a comment..." onkeydown="if(event.key==='Enter') submitComment('${p.id}')">
            <button class="btn btn-primary btn-small" onclick="submitComment('${p.id}')">Reply</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Toggle Like
async function toggleLike(id) {
  try {
    const res = await fetch(`/api/posts/${id}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: state.currentUser.id })
    });
    const data = await res.json();
    
    const post = state.posts.find(p => p.id === id);
    if (post) {
      if (data.isLiked) post.likes.push(state.currentUser.id);
      else post.likes = post.likes.filter(uid => uid !== state.currentUser.id);
      renderPosts();
    }
  } catch (e) {
    toast('Action failed', 'warning');
  }
}

// Toggle Comment Drawer
function toggleCommentDrawer(id) {
  const el = document.getElementById(`comments-${id}`);
  if (el) el.classList.toggle('hidden');
}

// Submit Comment
async function submitComment(id) {
  const input = document.getElementById(`comment-input-${id}`);
  const text = input ? input.value.trim() : '';
  if (!text) return;

  try {
    const res = await fetch(`/api/posts/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, userId: state.currentUser.id })
    });
    const data = await res.json();

    const post = state.posts.find(p => p.id === id);
    if (post) {
      post.comments.push(data.comment);
      renderPosts();
      document.getElementById(`comments-${id}`).classList.remove('hidden');
    }
    toast('Comment published!', 'success');
  } catch (e) {
    toast('Failed to publish comment', 'warning');
  }
}

// Create New Post
async function createPost() {
  const content = composerInput.value.trim();
  if (!content && !state.selectedImg) {
    toast('Please enter text or choose an image', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        image: state.selectedImg,
        userId: state.currentUser.id
      })
    });
    const data = await res.json();
    state.posts.unshift(data.post);
    renderPosts();

    composerInput.value = '';
    clearSelectedImg();
    toast('Post published to feed!', 'success');
  } catch (e) {
    toast('Failed to publish post', 'warning');
  }
}

// Delete Post
async function deletePost(id) {
  if (!confirm('Are you sure you want to delete this post?')) return;
  try {
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    state.posts = state.posts.filter(p => p.id !== id);
    renderPosts();
    toast('Post deleted', 'info');
  } catch (e) {
    toast('Failed to delete post', 'warning');
  }
}

// Load Suggested Creators
async function loadSuggestedUsers() {
  try {
    const res = await fetch('/api/users');
    state.users = await res.json();
    
    const list = document.getElementById('suggested-users-list');
    const filtered = state.users.filter(u => u.id !== state.currentUser.id);

    list.innerHTML = filtered.map(u => {
      const isFollowing = state.currentUser.following.includes(u.id);
      return `
        <div class="suggested-user-item">
          <div class="suggested-user-info" onclick="viewUserProfile('${u.username}')">
            <img src="${u.avatar}" class="avatar-sm">
            <div>
              <div class="suggested-name">${u.name}</div>
              <div class="suggested-handle">@${u.username}</div>
            </div>
          </div>
          <button class="follow-btn ${isFollowing ? 'following' : ''}" onclick="toggleFollow('${u.username}')">
            ${isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      `;
    }).join('');
  } catch (e) {}
}

// Toggle Follow / Unfollow
async function toggleFollow(username) {
  try {
    const res = await fetch(`/api/users/${username}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentUserId: state.currentUser.id })
    });
    const data = await res.json();

    const targetUser = state.users.find(u => u.username === username);
    if (targetUser) {
      if (data.isFollowing) {
        if (!state.currentUser.following.includes(targetUser.id)) state.currentUser.following.push(targetUser.id);
      } else {
        state.currentUser.following = state.currentUser.following.filter(id => id !== targetUser.id);
      }
    }

    toast(data.message, 'success');
    loadSuggestedUsers();
    updateUserBadge();
  } catch (e) {
    toast('Failed to update follow status', 'warning');
  }
}

// View User Profile Modal
async function viewUserProfile(username) {
  try {
    const res = await fetch(`/api/users/${username}`);
    const user = await res.json();

    const modal = document.getElementById('profile-modal');
    const body = document.getElementById('profile-modal-body');
    const isFollowing = state.currentUser.following.includes(user.id);
    const isSelf = user.id === state.currentUser.id;

    body.innerHTML = `
      <div class="profile-hero">
        <img src="${user.banner}" class="profile-cover-img">
        <div class="profile-header-details">
          <div class="profile-action-row">
            <img src="${user.avatar}" class="profile-main-avatar">
            ${!isSelf ? `
              <button class="follow-btn ${isFollowing ? 'following' : ''}" onclick="toggleFollow('${user.username}'); closeProfileModal();">
                ${isFollowing ? 'Following' : 'Follow'}
              </button>
            ` : ''}
          </div>
          <h2>${user.name}</h2>
          <span style="color:var(--text-dim); font-size:0.85rem;">@${user.username} &bull; Joined ${user.joined}</span>
          <p class="profile-bio">${user.bio}</p>

          <div class="profile-stats-bar">
            <div><strong>${user.postsCount}</strong> Posts</div>
            <div><strong>${user.followersCount}</strong> Followers</div>
            <div><strong>${user.followingCount}</strong> Following</div>
          </div>

          <h4 style="margin-bottom:12px;"><i class="fa-solid fa-grid-2"></i> Posts by ${user.name}</h4>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${(user.posts || []).map(p => `
              <div style="background:var(--bg-elevated); padding:12px; border-radius:8px; border:1px solid var(--border-color);">
                <div style="font-size:0.9rem;">${escapeHTML(p.content)}</div>
                ${p.image ? `<img src="${p.image}" style="width:100%; max-height:180px; object-fit:cover; border-radius:6px; margin-top:8px;">` : ''}
              </div>
            `).join('') || '<p style="color:var(--text-dim);">No posts yet.</p>'}
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');
  } catch (e) {
    toast('Failed to load profile', 'warning');
  }
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('active');
}

function updateUserBadge() {
  document.getElementById('sidebar-followers').textContent = state.currentUser.followers.length;
  document.getElementById('sidebar-following').textContent = state.currentUser.following.length;
}

function clearSelectedImg() {
  state.selectedImg = null;
  if (mediaFileInput) mediaFileInput.value = '';
  document.getElementById('composer-img-preview-box').classList.add('hidden');
}

function sharePost(id) {
  navigator.clipboard.writeText(window.location.origin + `#post-${id}`);
  toast('Post link copied to clipboard!', 'info');
}

function filterByTag(tag) {
  document.getElementById('search-input').value = `#${tag}`;
  state.search = tag;
  loadPosts();
}

function escapeHTML(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Init Events
function initEvents() {
  publishPostBtn.addEventListener('click', createPost);

  // Native Device Gallery File Chooser
  const addImgBtn = document.getElementById('add-img-tool-btn');
  addImgBtn.addEventListener('click', () => {
    mediaFileInput.click();
  });

  mediaFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        state.selectedImg = evt.target.result;
        document.getElementById('composer-preview-img').src = state.selectedImg;
        document.getElementById('composer-img-preview-box').classList.remove('hidden');
        toast('Photo selected from device gallery!', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  // Sample Image Preset Button
  document.getElementById('sample-img-btn').addEventListener('click', () => {
    const samples = [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1000&q=80'
    ];
    state.selectedImg = samples[Math.floor(Math.random() * samples.length)];
    document.getElementById('composer-preview-img').src = state.selectedImg;
    document.getElementById('composer-img-preview-box').classList.remove('hidden');
    toast('Sample image added to post', 'info');
  });

  document.getElementById('remove-img-btn').addEventListener('click', clearSelectedImg);

  // Search
  const searchInput = document.getElementById('search-input');
  const clearSearch = document.getElementById('clear-search');

  searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.trim();
    if (state.search) clearSearch.classList.remove('hidden');
    else clearSearch.classList.add('hidden');
    loadPosts();
  });

  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.search = '';
    clearSearch.classList.add('hidden');
    loadPosts();
  });

  // Feed Tabs
  document.querySelectorAll('.feed-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.feed = tab.dataset.tab;
      loadPosts();
    });
  });

  // Left Sidebar
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
      item.classList.add('active');
      state.feed = item.dataset.feed;
      loadPosts();
    });
  });

  // Modals
  document.getElementById('new-post-nav-btn').addEventListener('click', () => {
    composerInput.focus();
  });

  document.getElementById('user-profile-nav').addEventListener('click', () => {
    viewUserProfile(state.currentUser.username);
  });

  document.getElementById('close-profile-modal').addEventListener('click', closeProfileModal);
}
