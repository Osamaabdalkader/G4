// استيراد تكوين Firebase
import { 
  app, analytics, auth, database, storage,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, ref, set, push, onValue, 
  serverTimestamp, update, remove, query, orderByChild, 
  equalTo, storageRef, uploadBytesResumable, getDownloadURL 
} from './firebase-config.js';

// متغيرات النظام
let activeUserId = null;
let userMessages = {};
let userUnreadCounts = {};
let userLastMessageTime = {};
let currentUserData = null;
let messagesListener = null;
let currentPost = null;
let adminUsers = [];
let currentOrders = [];
let currentOrder = null;
let ordersListener = null;
let currentPostId = null;

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// تهيئة التطبيق بناءً على الصفحة الحالية
function initializeApp() {
    // تحميل المشرفين
    loadAdminUsers();
    
    // إضافة أيقونة الإدارة إلى Footer
    addAdminIconToFooter();
    
    // التحقق من حالة المصادقة
    onAuthStateChanged(auth, user => {
        if (user) {
            // تحميل بيانات المستخدم الحالي
            const userRef = ref(database, 'users/' + user.uid);
            onValue(userRef, (snapshot) => {
                if (snapshot.exists()) {
                    currentUserData = snapshot.val();
                    currentUserData.uid = user.uid;
                    
                    // عرض/إخفاء أيقونة الإدارة
                    toggleAdminIcon();
                    
                    // تحميل المحتوى بناءً على الصفحة الحالية
                    loadPageContent();
                }
            });
        } else {
            // إذا لم يكن المستخدم مسجلاً دخوله، إعادة توجيه إلى صفحة المصادقة
            // ولكن فقط إذا لم نكن بالفعل في صفحة المصادقة
            if (!window.location.pathname.includes('auth.html') && 
                !window.location.pathname.includes('index.html') &&
                window.location.pathname !== '/' &&
                !window.location.pathname.endsWith('/')) {
                window.location.href = 'auth.html';
            }
        }
    });
    
    // إرفاق معالجات الأحداث بناءً على الصفحة الحالية
    attachEventHandlers();
}

// تحميل محتوى الصفحة بناءً على الصفحة الحالية
function loadPageContent() {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
        loadPosts();
    } else if (path.includes('orders.html')) {
        loadOrders();
    } else if (path.includes('profile.html')) {
        loadUserProfile();
    } else if (path.includes('messages.html')) {
        loadMessages();
    } else if (path.includes('post-detail.html')) {
        const postId = urlParams.get('id');
        if (postId) {
            loadPostDetail(postId);
        } else {
            // إذا لم يتم توفير معرف المنشور، العودة إلى الصفحة الرئيسية
            window.location.href = 'index.html';
        }
    } else if (path.includes('order-detail.html')) {
        const orderId = urlParams.get('id');
        if (orderId) {
            loadOrderDetail(orderId);
        } else {
            // إذا لم يتم توفير معرف الطلب، العودة إلى صفحة الطلبات
            window.location.href = 'orders.html';
        }
    }
}

// إرفاق معالجات الأحداث بناءً على العناصر المتوفرة في الصفحة
function attachEventHandlers() {
    // معالجات أحداث صفحة المصادقة
    if (document.getElementById('login-btn')) {
        document.getElementById('login-btn').addEventListener('click', handleLogin);
    }
    
    if (document.getElementById('signup-btn')) {
        document.getElementById('signup-btn').addEventListener('click', handleSignup);
    }
    
    if (document.getElementById('login-tab')) {
        document.getElementById('login-tab').addEventListener('click', () => switchAuthTab('login'));
    }
    
    if (document.getElementById('signup-tab')) {
        document.getElementById('signup-tab').addEventListener('click', () => switchAuthTab('signup'));
    }
    
    // معالجات أحداث صفحة الملف الشخصي
    if (document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').addEventListener('click', handleLogout);
    }
    
    // معالجات أحداث صفحة إضافة المنشور
    if (document.getElementById('publish-btn')) {
        document.getElementById('publish-btn').addEventListener('click', handlePublishPost);
    }
    
    if (document.getElementById('choose-image-btn')) {
        document.getElementById('choose-image-btn').addEventListener('click', () => document.getElementById('post-image').click());
    }
    
    if (document.getElementById('camera-btn')) {
        document.getElementById('camera-btn').addEventListener('click', openCamera);
    }
    
    if (document.getElementById('remove-image-btn')) {
        document.getElementById('remove-image-btn').addEventListener('click', removeSelectedImage);
    }
    
    if (document.getElementById('post-image')) {
        document.getElementById('post-image').addEventListener('change', handleImageSelection);
    }
    
    // معالجات أحداث صفحة الرسائل
    if (document.getElementById('send-message-btn')) {
        document.getElementById('send-message-btn').addEventListener('click', handleSendMessage);
    }
    
    // معالجات أحداث صفحة تفاصيل المنشور
    if (document.getElementById('buy-now-btn')) {
        document.getElementById('buy-now-btn').addEventListener('click', handleBuyNow);
    }
    
    // معالجات أحداث صفحة الطلبات
    const filterBtns = document.querySelectorAll('.filter-btn');
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadOrders(btn.dataset.filter);
            });
        });
    }
    
    // معالجات أحداث صفحة تفاصيل الطلب
    if (document.getElementById('approve-order-btn')) {
        document.getElementById('approve-order-btn').addEventListener('click', handleApproveOrder);
    }
    
    if (document.getElementById('reject-order-btn')) {
        document.getElementById('reject-order-btn').addEventListener('click', handleRejectOrder);
    }
    
    if (document.getElementById('chat-with-buyer-btn')) {
        document.getElementById('chat-with-buyer-btn').addEventListener('click', handleChatWithBuyer);
    }
    
    if (document.getElementById('chat-with-seller-btn')) {
        document.getElementById('chat-with-seller-btn').addEventListener('click', handleChatWithSeller);
    }
}

// ==================== دوال المصادقة ====================
function handleLogin(e) {
    if (e) e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showAuthMessage('يرجى ملء جميع الحقول', 'error');
        return;
    }
    
    showLoading(true);
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            showLoading(false);
            // بعد تسجيل الدخول بنجاح، الانتقال إلى الصفحة الرئيسية
            window.location.href = 'index.html';
        })
        .catch((error) => {
            showLoading(false);
            showAuthMessage(getAuthErrorMessage(error.code), 'error');
        });
}

function handleSignup(e) {
    if (e) e.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const address = document.getElementById('signup-address').value;
    
    if (!name || !phone || !email || !password || !address) {
        showAuthMessage('يرجى ملء جميع الحقول', 'error');
        return;
    }
    
    if (password.length < 6) {
        showAuthMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
    }
    
    showLoading(true);
    
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            
            // حفظ بيانات المستخدم الإضافية في قاعدة البيانات
            const userData = {
                name: name,
                phone: phone,
                email: email,
                address: address,
                createdAt: serverTimestamp(),
                isAdmin: false
            };
            
            return set(ref(database, 'users/' + user.uid), userData);
        })
        .then(() => {
            showLoading(false);
            showAuthMessage('تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن', 'success');
            switchAuthTab('login');
        })
        .catch((error) => {
            showLoading(false);
            showAuthMessage(getAuthErrorMessage(error.code), 'error');
        });
}

function handleLogout() {
    signOut(auth).then(() => {
        // بعد تسجيل الخروج، الانتقال إلى الصفحة الرئيسية
        window.location.href = 'index.html';
    });
}

function switchAuthTab(tab) {
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    } else {
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    }
}

// ==================== دوال المنشورات ====================
function loadPosts() {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;
    
    postsContainer.innerHTML = '<div class="loading-text">جاري تحميل المنشورات...</div>';
    
    const postsRef = ref(database, 'posts');
    onValue(postsRef, (snapshot) => {
        postsContainer.innerHTML = '';
        
        if (!snapshot.exists()) {
            postsContainer.innerHTML = '<div class="no-orders">لا توجد منشورات حالياً</div>';
            return;
        }
        
        const posts = snapshot.val();
        Object.keys(posts).forEach(postId => {
            const post = posts[postId];
            post.id = postId;
            const postCard = createPostCard(post);
            postsContainer.appendChild(postCard);
        });
    });
}

function createPostCard(post) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    postCard.addEventListener('click', () => {
        // الانتقال إلى صفحة تفاصيل المنشور مع معرف المنشور
        window.location.href = `post-detail.html?id=${post.id}`;
    });
    
    postCard.innerHTML = `
        <div class="post-image">
            ${post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}">` : 
            `<i class="fas fa-image"></i>`}
        </div>
        <div class="post-content">
            <h3 class="post-title">${post.title}</h3>
            <p class="post-description">${post.description}</p>
            <div class="post-meta">
                <span class="post-price">${post.price ? `${post.price} ر.س` : 'السعر: غير محدد'}</span>
                <span class="post-author">
                    <i class="fas fa-user"></i> ${post.authorName || 'مستخدم'}
                </span>
            </div>
        </div>
    `;
    
    return postCard;
}

function handlePublishPost(e) {
    if (e) e.preventDefault();
    
    const title = document.getElementById('post-title').value;
    const description = document.getElementById('post-description').value;
    const price = document.getElementById('post-price').value;
    const location = document.getElementById('post-location').value;
    const phone = document.getElementById('post-phone').value;
    const imageFile = document.getElementById('post-image').files[0];
    
    if (!title || !description || !phone) {
        showMessage('يرجى ملء جميع الحقول الإلزامية', 'error');
        return;
    }
    
    const user = auth.currentUser;
    if (!user) {
        showMessage('يجب تسجيل الدخول أولاً', 'error');
        window.location.href = 'auth.html';
        return;
    }
    
    showLoading(true, 'جاري نشر المنشور...');
    
    // إذا تم اختيار صورة، رفعها أولاً
    if (imageFile) {
        const storageReference = storageRef(storage, 'posts/' + Date.now() + '_' + imageFile.name);
        const uploadTask = uploadBytesResumable(storageReference, imageFile);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                updateProgress(progress);
            },
            (error) => {
                showLoading(false);
                showMessage('فشل في رفع الصورة: ' + error.message, 'error');
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    savePostToDatabase(title, description, price, location, phone, downloadURL, user);
                });
            }
        );
    } else {
        savePostToDatabase(title, description, price, location, phone, null, user);
    }
}

function savePostToDatabase(title, description, price, location, phone, imageUrl, user) {
    const newPostKey = push(ref(database, 'posts')).key;
    
    const postData = {
        title: title,
        description: description,
        price: price || null,
        location: location || null,
        phone: phone,
        imageUrl: imageUrl || null,
        authorId: user.uid,
        authorName: currentUserData.name,
        createdAt: serverTimestamp()
    };
    
    set(ref(database, 'posts/' + newPostKey), postData)
        .then(() => {
            showLoading(false);
            showMessage('تم نشر المنشور بنجاح!', 'success');
            resetAddPostForm();
            // الانتقال إلى الصفحة الرئيسية بعد النشر
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        })
        .catch((error) => {
            showLoading(false);
            showMessage('فشل في نشر المنشور: ' + error.message, 'error');
        });
}

function loadPostDetail(postId) {
    const postDetailContent = document.getElementById('post-detail-content');
    if (!postDetailContent) return;
    
    postDetailContent.innerHTML = '<div class="loading-text">جاري تحميل تفاصيل المنشور...</div>';
    
    const postRef = ref(database, 'posts/' + postId);
    onValue(postRef, (snapshot) => {
        if (!snapshot.exists()) {
            postDetailContent.innerHTML = '<div class="no-orders">المنشور غير موجود</div>';
            return;
        }
        
        const post = snapshot.val();
        post.id = postId;
        currentPost = post;
        
        postDetailContent.innerHTML = `
            ${post.imageUrl ? `<img src="${post.imageUrl}" alt="${post.title}" class="post-detail-image">` : 
            `<div class="post-detail-image" style="display:flex;align-items:center;justify-content:center;background:#f5f5f5;">
                <i class="fas fa-image" style="font-size:3rem;color:#ccc;"></i>
            </div>`}
            <h2 class="post-detail-title">${post.title}</h2>
            <p class="post-detail-description">${post.description}</p>
            <div class="post-detail-meta">
                <div class="meta-item">
                    <i class="fas fa-tag"></i>
                    <span>${post.price ? `${post.price} ر.س` : 'السعر: غير محدد'}</span>
                </div>
                ${post.location ? `<div class="meta-item">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${post.location}</span>
                </div>` : ''}
                <div class="meta-item">
                    <i class="fas fa-phone"></i>
                    <span>${post.phone}</span>
                </div>
            </div>
            <div class="post-detail-author">
                <div class="author-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="author-info">
                    <div class="author-name">${post.authorName || 'مستخدم'}</div>
                    <div class="author-contact">تواصل مع البائع</div>
                </div>
            </div>
        `;
    });
}

function handleBuyNow() {
    const user = auth.currentUser;
    if (!user) {
        showMessage('يجب تسجيل الدخول أولاً', 'error');
        window.location.href = 'auth.html';
        return;
    }
    
    if (!currentPost) {
        showMessage('لم يتم تحميل تفاصيل المنشور', 'error');
        return;
    }
    
    showLoading(true, 'جاري إنشاء الطلب...');
    
    createOrder(user.uid, currentPost)
        .then(() => {
            showLoading(false);
            showMessage('تم إنشاء الطلب بنجاح! سنقوم بالتواصل معك قريباً', 'success');
        })
        .catch((error) => {
            showLoading(false);
            showMessage('فشل في إنشاء الطلب: ' + error.message, 'error');
        });
}

// ==================== دوال الطلبات ====================
async function createOrder(userId, post) {
    try {
        const orderData = {
            buyerId: userId,
            sellerId: post.authorId,
            postId: post.id,
            postTitle: post.title,
            postPrice: post.price || 'غير محدد',
            postImage: post.imageUrl || '',
            status: 'pending',
            createdAt: serverTimestamp(),
            buyerName: currentUserData.name,
            buyerPhone: currentUserData.phone
        };

        const newOrderRef = push(ref(database, 'orders'));
        await set(newOrderRef, orderData);
        
        return newOrderRef.key;
    } catch (error) {
        throw error;
    }
}

function loadOrders(filter = 'all') {
    const ordersContainer = document.getElementById('orders-container');
    if (!ordersContainer) return;
    
    ordersContainer.innerHTML = '<div class="loading-text">جاري تحميل الطلبات...</div>';
    
    const ordersRef = ref(database, 'orders');
    
    // إزالة المستمع السابق إذا كان موجوداً
    if (ordersListener) {
        ordersListener();
    }
    
    ordersListener = onValue(ordersRef, (snapshot) => {
        ordersContainer.innerHTML = '';
        currentOrders = [];
        
        if (!snapshot.exists()) {
            ordersContainer.innerHTML = '<div class="no-orders">لا توجد طلبات حالياً</div>';
            return;
        }
        
        const orders = snapshot.val();
        const ordersByPost = {};
        
        Object.keys(orders).forEach(orderId => {
            const order = orders[orderId];
            order.id = orderId;
            
            // تطبيق الفلتر
            if (filter !== 'all' && order.status !== filter) {
                return;
            }
            
            currentOrders.push(order);
            
            if (!ordersByPost[order.postId]) {
                ordersByPost[order.postId] = {
                    postId: order.postId,
                    postTitle: order.postTitle,
                    orders: []
                };
            }
            
            ordersByPost[order.postId].orders.push(order);
        });
        
        if (Object.keys(ordersByPost).length === 0) {
            ordersContainer.innerHTML = '<div class="no-orders">لا توجد طلبات تطابق المعايير</div>';
            return;
        }
        
        Object.values(ordersByPost).forEach(postData => {
            const orderElement = createPostOrderItem(postData);
            ordersContainer.appendChild(orderElement);
        });
    });
}

function createPostOrderItem(postData) {
    const orderElement = document.createElement('div');
    orderElement.className = 'order-item';
    orderElement.dataset.postId = postData.postId;
    
    const pendingCount = postData.orders.filter(o => o.status === 'pending').length;
    const approvedCount = postData.orders.filter(o => o.status === 'approved').length;
    const rejectedCount = postData.orders.filter(o => o.status === 'rejected').length;
    
    orderElement.innerHTML = `
        <div class="order-header">
            <h3 class="order-title">${postData.postTitle}</h3>
            <span class="order-count">${postData.orders.length} طلب</span>
        </div>
        <div class="order-statuses">
            ${pendingCount > 0 ? `<span class="status-badge status-pending">${pendingCount} قيد الانتظار</span>` : ''}
            ${approvedCount > 0 ? `<span class="status-badge status-approved">${approvedCount} مقبولة</span>` : ''}
            ${rejectedCount > 0 ? `<span class="status-badge status-rejected">${rejectedCount} مرفوضة</span>` : ''}
        </div>
    `;
    
    orderElement.addEventListener('click', () => {
        showPostOrders(postData);
    });
    
    return orderElement;
}

function showPostOrders(postData) {
    const ordersContainer = document.getElementById('orders-container');
    if (!ordersContainer) return;
    
    ordersContainer.innerHTML = `
        <button class="btn back-btn" id="back-to-orders">
            <i class="fas fa-arrow-right"></i> العودة إلى قائمة الطلبات
        </button>
        <div class="post-orders-header">
            <h3>${postData.postTitle}</h3>
            <p>إدارة طلبات هذا المنشور</p>
        </div>
    `;
    
    const backButton = document.getElementById('back-to-orders');
    backButton.addEventListener('click', () => {
        loadOrders(document.querySelector('.filter-btn.active').dataset.filter);
    });
    
    postData.orders.forEach(order => {
        const orderElement = createIndividualOrderItem(order);
        ordersContainer.appendChild(orderElement);
    });
}

function createIndividualOrderItem(order) {
    const orderElement = document.createElement('div');
    orderElement.className = 'order-item individual-order';
    orderElement.dataset.orderId = order.id;
    
    let statusClass = 'status-pending';
    let statusText = 'قيد الانتظار';
    
    if (order.status === 'approved') {
        statusClass = 'status-approved';
        statusText = 'مقبولة';
    } else if (order.status === 'rejected') {
        statusClass = 'status-rejected';
        statusText = 'مرفوضة';
    }
    
    orderElement.innerHTML = `
        <div class="order-header">
            <h3 class="order-title">طلب من ${order.buyerName}</h3>
            <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <div class="order-meta">
            <span>${formatDate(order.createdAt)}</span>
            <span class="order-price">${order.postPrice} ر.س</span>
        </div>
    `;
    
    orderElement.addEventListener('click', () => {
        // الانتقال إلى صفحة تفاصيل الطلب
        window.location.href = `order-detail.html?id=${order.id}`;
    });
    
    return orderElement;
}

function loadOrderDetail(orderId) {
    const orderDetailContent = document.getElementById('order-detail-content');
    if (!orderDetailContent) return;
    
    orderDetailContent.innerHTML = '<div class="loading-text">جاري تحميل تفاصيل الطلب...</div>';
    
    const orderRef = ref(database, 'orders/' + orderId);
    onValue(orderRef, (snapshot) => {
        if (!snapshot.exists()) {
            orderDetailContent.innerHTML = '<div class="no-orders">الطلب غير موجود</div>';
            return;
        }
        
        const order = snapshot.val();
        order.id = orderId;
        currentOrder = order;
        
        let statusClass = 'status-pending';
        let statusText = 'قيد الانتظار';
        
        if (order.status === 'approved') {
            statusClass = 'status-approved';
            statusText = 'مقبولة';
        } else if (order.status === 'rejected') {
            statusClass = 'status-rejected';
            statusText = 'مرفوضة';
        }
        
        orderDetailContent.innerHTML = `
            <div class="order-detail-section">
                <h3>معلومات الطلب</h3>
                <div class="order-detail-item">
                    <span class="order-detail-label">المنشور:</span>
                    <span class="order-detail-value">${order.postTitle}</span>
                </div>
                <div class="order-detail-item">
                    <span class="order-detail-label">السعر:</span>
                    <span class="order-detail-value">${order.postPrice} ر.س</span>
                </div>
                <div class="order-detail-item">
                    <span class="order-detail-label">الحالة:</span>
                    <span class="order-detail-value ${statusClass}">${statusText}</span>
                </div>
                <div class="order-detail-item">
                    <span class="order-detail-label">تاريخ الطلب:</span>
                    <span class="order-detail-value">${formatDate(order.createdAt)}</span>
                </div>
            </div>
            
            <div class="order-detail-section">
                <h3>معلومات المشتري</h3>
                <div class="order-detail-item">
                    <span class="order-detail-label">الاسم:</span>
                    <span class="order-detail-value">${order.buyerName}</span>
                </div>
                <div class="order-detail-item">
                    <span class="order-detail-label">الهاتف:</span>
                    <span class="order-detail-value">${order.buyerPhone}</span>
                </div>
            </div>
        `;
        
        // إظهار/إخفاء أزرار الإجراءات بناءً على حالة الطلب
        const approveBtn = document.getElementById('approve-order-btn');
        const rejectBtn = document.getElementById('reject-order-btn');
        
        if (order.status !== 'pending') {
            if (approveBtn) approveBtn.style.display = 'none';
            if (rejectBtn) rejectBtn.style.display = 'none';
        }
    });
}

function handleApproveOrder() {
    if (!currentOrder) return;
    
    showLoading(true, 'جاري قبول الطلب...');
    
    update(ref(database, 'orders/' + currentOrder.id), {
        status: 'approved',
        approvedAt: serverTimestamp()
    })
    .then(() => {
        showLoading(false);
        showMessage('تم قبول الطلب بنجاح', 'success');
        // إخفاء أزرار الموافقة والرفض
        document.getElementById('approve-order-btn').style.display = 'none';
        document.getElementById('reject-order-btn').style.display = 'none';
    })
    .catch((error) => {
        showLoading(false);
        showMessage('فشل في قبول الطلب: ' + error.message, 'error');
    });
}

function handleRejectOrder() {
    if (!currentOrder) return;
    
    showLoading(true, 'جاري رفض الطلب...');
    
    update(ref(database, 'orders/' + currentOrder.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp()
    })
    .then(() => {
        showLoading(false);
        showMessage('تم رفض الطلب بنجاح', 'success');
        // إخفاء أزرار الموافقة والرفض
        document.getElementById('approve-order-btn').style.display = 'none';
        document.getElementById('reject-order-btn').style.display = 'none';
    })
    .catch((error) => {
        showLoading(false);
        showMessage('فشل في رفض الطلب: ' + error.message, 'error');
    });
}

function handleChatWithBuyer() {
    if (!currentOrder) return;
    
    // الانتقال إلى صفحة الرسائل مع فتح محادثة مع المشتري
    window.location.href = `messages.html?userId=${currentOrder.buyerId}`;
}

function handleChatWithSeller() {
    if (!currentOrder) return;
    
    // الانتقال إلى صفحة الرسائل مع فتح محادثة مع البائع
    window.location.href = `messages.html?userId=${currentOrder.sellerId}`;
}

// ==================== دوال الرسائل ====================
function loadMessages() {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    
    loadAllUsersForAdmin(user.uid);
    
    // التحقق إذا كان هناك مستخدم محدد في رابط الصفحة
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');
    
    if (userId) {
        // تحميل معلومات المستخدم وفتح المحادثة معه
        const userRef = ref(database, 'users/' + userId);
        onValue(userRef, (snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                userData.id = userId;
                openChat(userData);
            }
        });
    }
}

function loadAllUsersForAdmin(currentUserId) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    usersList.innerHTML = '<div class="loading-text">جاري تحميل المستخدمين...</div>';
    
    const messagesRef = ref(database, 'messages');
    
    // إزالة المستمع السابق إذا كان موجوداً
    if (messagesListener) {
        messagesListener();
    }
    
    messagesListener = onValue(messagesRef, (snapshot) => {
        usersList.innerHTML = '';
        userMessages = {};
        userUnreadCounts = {};
        userLastMessageTime = {};
        
        if (!snapshot.exists()) {
            usersList.innerHTML = '<div class="no-users">لا توجد محادثات بعد</div>';
            return;
        }
        
        const messages = snapshot.val();
        const usersMap = new Map();
        
        Object.values(messages).forEach(message => {
            if (message.senderId === currentUserId || message.receiverId === currentUserId) {
                const otherUserId = message.senderId === currentUserId ? message.receiverId : message.senderId;
                
                if (!usersMap.has(otherUserId)) {
                    usersMap.set(otherUserId, {
                        lastMessage: message,
                        unreadCount: 0
                    });
                } else {
                    const existing = usersMap.get(otherUserId);
                    if (message.timestamp > existing.lastMessage.timestamp) {
                        existing.lastMessage = message;
                    }
                }
                
                // حساب الرسائل غير المقروءة
                if (message.receiverId === currentUserId && !message.isRead) {
                    const existing = usersMap.get(otherUserId);
                    existing.unreadCount = (existing.unreadCount || 0) + 1;
                }
            }
        });
        
        if (usersMap.size === 0) {
            usersList.innerHTML = '<div class="no-users">لا توجد محادثات بعد</div>';
            return;
        }
        
        // تحميل معلومات المستخدمين
        loadUsersInfo(Array.from(usersMap.keys()), currentUserId, usersMap);
    });
}

function loadUsersInfo(userIds, currentUserId, usersMap) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    usersList.innerHTML = '<div class="loading-text">جاري تحميل المستخدمين...</div>';
    
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        if (!snapshot.exists()) {
            usersList.innerHTML = '<div class="no-users">لا توجد محادثات بعد</div>';
            return;
        }
        
        const allUsers = snapshot.val();
        const usersToShow = [];
        
        userIds.forEach(userId => {
            if (allUsers[userId] && userId !== currentUserId) {
                const userData = allUsers[userId];
                userData.id = userId;
                userData.lastMessage = usersMap.get(userId).lastMessage;
                userData.unreadCount = usersMap.get(userId).unreadCount || 0;
                usersToShow.push(userData);
            }
        });
        
        if (usersToShow.length === 0) {
            usersList.innerHTML = '<div class="no-users">لا توجد محادثات بعد</div>';
            return;
        }
        
        displayUsersList(usersToShow, currentUserId);
    });
}

function displayUsersList(users, currentUserId) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        if (user.unreadCount > 0) {
            userItem.classList.add('unread');
        }
        userItem.dataset.userId = user.id;
        
        const lastMessage = user.lastMessage || {};
        const messageTime = lastMessage.timestamp ? formatDate(lastMessage.timestamp, true) : '';
        const messageContent = lastMessage.content ? 
            (lastMessage.content.length > 30 ? lastMessage.content.substring(0, 30) + '...' : lastMessage.content) : 
            'لا توجد رسائل بعد';
        
        userItem.innerHTML = `
            <div class="user-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-status">${messageContent}</div>
            </div>
            <div class="message-info">
                <div class="message-time">${messageTime}</div>
                ${user.unreadCount > 0 ? `<div class="unread-badge">${user.unreadCount}</div>` : ''}
            </div>
        `;
        
        userItem.addEventListener('click', () => {
            openChat(user);
        });
        
        usersList.appendChild(userItem);
    });
}

function openChat(userData) {
    activeUserId = userData.id;
    
    const currentChatUser = document.getElementById('current-chat-user');
    const messageInputContainer = document.getElementById('message-input-container');
    
    if (currentChatUser) {
        currentChatUser.textContent = userData.name;
    }
    
    if (messageInputContainer) {
        messageInputContainer.classList.remove('hidden');
    }
    
    displayMessages(userData.id);
    markMessagesAsRead(userData.id);
}

function displayMessages(userId) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '<div class="loading-text">جاري تحميل الرسائل...</div>';
    
    const messagesRef = ref(database, 'messages');
    const user = auth.currentUser;
    
    onValue(messagesRef, (snapshot) => {
        messagesContainer.innerHTML = '';
        
        if (!snapshot.exists()) {
            messagesContainer.innerHTML = '<div class="no-chat-selected">لا توجد رسائل بعد</div>';
            return;
        }
        
        const messages = snapshot.val();
        const chatMessages = [];
        
        Object.values(messages).forEach(message => {
            if ((message.senderId === user.uid && message.receiverId === userId) ||
                (message.senderId === userId && message.receiverId === user.uid)) {
                chatMessages.push(message);
            }
        });
        
        if (chatMessages.length === 0) {
            messagesContainer.innerHTML = '<div class="no-chat-selected">لا توجد رسائل بعد</div>';
            return;
        }
        
        // ترتيب الرسائل حسب الوقت
        chatMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        chatMessages.forEach(message => {
            addMessageToChat(message, userId);
        });
        
        // التمرير إلى أحدث رسالة
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function addMessageToChat(message, userId) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    const user = auth.currentUser;
    const isSent = message.senderId === user.uid;
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const messageTime = message.timestamp ? formatDate(message.timestamp, true) : '';
    
    messageElement.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-time">${messageTime}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
}

function markMessagesAsRead(userId) {
    const user = auth.currentUser;
    if (!user) return;
    
    const messagesRef = ref(database, 'messages');
    onValue(messagesRef, (snapshot) => {
        if (!snapshot.exists()) return;
        
        const messages = snapshot.val();
        const updates = {};
        
        Object.keys(messages).forEach(messageId => {
            const message = messages[messageId];
            if (message.senderId === userId && message.receiverId === user.uid && !message.isRead) {
                updates[`${messageId}/isRead`] = true;
            }
        });
        
        if (Object.keys(updates).length > 0) {
            update(ref(database, 'messages'), updates);
        }
    });
}

function handleSendMessage() {
    const messageInput = document.getElementById('message-input');
    if (!messageInput || !activeUserId) return;
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    const user = auth.currentUser;
    if (!user) return;
    
    sendMessageToUser(message, user, activeUserId);
    messageInput.value = '';
}

function sendMessageToUser(message, user, receiverId) {
    const newMessage = {
        senderId: user.uid,
        receiverId: receiverId,
        content: message,
        timestamp: serverTimestamp(),
        isRead: false
    };
    
    const newMessageRef = push(ref(database, 'messages'));
    set(newMessageRef, newMessage)
        .catch((error) => {
            showMessage('فشل في إرسال الرسالة: ' + error.message, 'error');
        });
}

// ==================== دوال الملف الشخصي ====================
function loadUserProfile() {
    const userInfo = document.getElementById('user-info');
    if (!userInfo) return;
    
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'auth.html';
        return;
    }
    
    userInfo.innerHTML = '<div class="loading-text">جاري تحميل المعلومات...</div>';
    
    const userRef = ref(database, 'users/' + user.uid);
    onValue(userRef, (snapshot) => {
        if (!snapshot.exists()) {
            userInfo.innerHTML = '<div class="no-orders">لم يتم العثور على معلومات المستخدم</div>';
            return;
        }
        
        const userData = snapshot.val();
        
        userInfo.innerHTML = `
            <div class="user-detail">
                <i class="fas fa-user"></i>
                <span>${userData.name || 'غير محدد'}</span>
            </div>
            <div class="user-detail">
                <i class="fas fa-phone"></i>
                <span>${userData.phone || 'غير محدد'}</span>
            </div>
            <div class="user-detail">
                <i class="fas fa-envelope"></i>
                <span>${userData.email || 'غير محدد'}</span>
            </div>
            <div class="user-detail">
                <i class="fas fa-map-marker-alt"></i>
                <span>${userData.address || 'غير محدد'}</span>
            </div>
            <div class="user-detail">
                <i class="fas fa-shield-alt"></i>
                <span>${userData.isAdmin ? 'مدير النظام' : 'مستخدم عادي'}</span>
            </div>
        `;
    });
}

// ==================== دوال مساعدة ====================
function loadAdminUsers() {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
        adminUsers = [];
        
        if (snapshot.exists()) {
            const users = snapshot.val();
            Object.keys(users).forEach(userId => {
                if (users[userId].isAdmin) {
                    adminUsers.push(userId);
                }
            });
        }
    });
}

function addAdminIconToFooter() {
    const footerIcons = document.querySelector('.footer-icons');
    if (!footerIcons) return;
    
    // التحقق إذا كانت أيقونة الإدارة موجودة بالفعل
    if (!document.getElementById('admin-icon')) {
        const adminIcon = document.createElement('a');
        adminIcon.href = 'orders.html';
        adminIcon.className = 'icon';
        adminIcon.id = 'admin-icon';
        adminIcon.style.display = 'none';
        adminIcon.innerHTML = `
            <i class="fas fa-cog"></i>
            <span>الإدارة</span>
        `;
        
        // إضافة أيقونة الإدارة قبل أيقونة "المزيد"
        const moreIcon = document.getElementById('more-icon');
        if (moreIcon) {
            footerIcons.insertBefore(adminIcon, moreIcon);
        } else {
            footerIcons.appendChild(adminIcon);
        }
    }
    
    toggleAdminIcon();
}

function toggleAdminIcon() {
    const adminIcon = document.getElementById('admin-icon');
    if (!adminIcon) return;
    
    if (currentUserData && currentUserData.isAdmin) {
        adminIcon.style.display = 'flex';
    } else {
        adminIcon.style.display = 'none';
    }
}

function showLoading(show, message = 'جاري التحميل...') {
    // إنشاء overlay التحميل إذا لم يكن موجوداً
    let loadingOverlay = document.getElementById('loading-overlay');
    
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'loading-overlay hidden';
        loadingOverlay.innerHTML = `
            <div class="spinner"></div>
            <div id="loading-message">${message}</div>
            <div class="progress-bar">
                <div class="progress" id="upload-progress"></div>
            </div>
        `;
        document.body.appendChild(loadingOverlay);
    }
    
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.textContent = message;
    }
    
    if (show) {
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

function updateProgress(progress) {
    const progressBar = document.getElementById('upload-progress');
    if (progressBar) {
        progressBar.style.width = progress + '%';
    }
}

function showMessage(message, type) {
    // إنشاء عنصر الرسالة إذا لم يكن موجوداً
    let messageElement = document.getElementById('global-message');
    
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.id = 'global-message';
        messageElement.style.position = 'fixed';
        messageElement.style.top = '20px';
        messageElement.style.left = '50%';
        messageElement.style.transform = 'translateX(-50%)';
        messageElement.style.padding = '10px 20px';
        messageElement.style.borderRadius = '5px';
        messageElement.style.zIndex = '10000';
        messageElement.style.maxWidth = '80%';
        messageElement.style.textAlign = 'center';
        document.body.appendChild(messageElement);
    }
    
    messageElement.textContent = message;
    messageElement.className = '';
    
    if (type === 'error') {
        messageElement.style.backgroundColor = '#ffebee';
        messageElement.style.color = '#f44336';
        messageElement.style.border = '1px solid #ffcdd2';
    } else {
        messageElement.style.backgroundColor = '#e8f5e9';
        messageElement.style.color = '#4caf50';
        messageElement.style.border = '1px solid #c8e6c9';
    }
    
    // إخفاء الرسالة بعد 3 ثوان
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 3000);
    
    messageElement.style.display = 'block';
}

function showAuthMessage(message, type) {
    const authMessage = document.getElementById('auth-message');
    if (!authMessage) return;
    
    authMessage.textContent = message;
    authMessage.className = '';
    authMessage.classList.add(type + '-message');
    authMessage.style.display = 'block';
}

function getAuthErrorMessage(code) {
    switch(code) {
        case 'auth/invalid-email': return 'البريد الإلكتروني غير صالح';
        case 'auth/user-disabled': return 'هذا الحساب معطل';
        case 'auth/user-not-found': return 'لا يوجد حساب مرتبط بهذا البريد الإلكتروني';
        case 'auth/wrong-password': return 'كلمة المرور غير صحيحة';
        case 'auth/email-already-in-use': return 'هذا البريد الإلكتروني مستخدم بالفعل';
        case 'auth/weak-password': return 'كلمة المرور ضعيفة (يجب أن تحتوي على 6 أحرف على الأقل)';
        default: return 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى';
    }
}

function resetAddPostForm() {
    document.getElementById('post-title').value = '';
    document.getElementById('post-description').value = '';
    document.getElementById('post-price').value = '';
    document.getElementById('post-location').value = '';
    document.getElementById('post-phone').value = '';
    document.getElementById('post-image').value = '';
    document.getElementById('image-name').textContent = 'لم يتم اختيار صورة';
    document.getElementById('image-preview').classList.add('hidden');
}

function formatDate(timestamp, short = false) {
    if (!timestamp) return 'غير معروف';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (short) {
        if (minutes < 1) return 'الآن';
        if (minutes < 60) return `منذ ${minutes} دقيقة`;
        if (hours < 24) return `منذ ${hours} ساعة`;
        if (days < 7) return `منذ ${days} يوم`;
        return date.toLocaleDateString('ar-SA');
    }
    
    if (days < 1) {
        return date.toLocaleTimeString('ar-SA');
    } else {
        return date.toLocaleDateString('ar-SA') + ' ' + date.toLocaleTimeString('ar-SA');
    }
}

function openCamera() {
    const postImageInput = document.getElementById('post-image');
    if (!postImageInput) return;
    
    postImageInput.setAttribute('capture', 'environment');
    postImageInput.click();
    // إعادة الضبط إلى الوضع الطبيعي بعد الاختيار
    setTimeout(() => {
        postImageInput.removeAttribute('capture');
    }, 1000);
}

function handleImageSelection() {
    const fileInput = document.getElementById('post-image');
    const imageName = document.getElementById('image-name');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        imageName.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removeSelectedImage() {
    const fileInput = document.getElementById('post-image');
    const imageName = document.getElementById('image-name');
    const imagePreview = document.getElementById('image-preview');
    
    fileInput.value = '';
    imageName.textContent = 'لم يتم اختيار صورة';
    imagePreview.classList.add('hidden');
}