const WHATSAPP_NUMBER = '918084509430';
const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/Jd0HeHZ14IK7Cj0cV9jGwT?mode=ems_copy_t';
const STORE_NAME = 'Alpaca F1 Jackets';
const SIZE_ORDER = { XS: 0, S: 1, M: 2, L: 3, XL: 4, '2XL': 5, XXL: 5, '3XL': 6, '4XL': 7, '5XL': 8 };
const PUBLIC_STOCK_CAP = 3; // Customers never see or order more than this per size. Admin keeps actual stock.

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

function setYear() {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
}

function setupNav() {
  const toggle = $('.nav-toggle');
  const nav = $('.nav');
  if (!toggle || !nav) return;

  const page = document.body?.dataset?.page || '';
  const activeMap = {
    shop: 'index.html',
    product: 'index.html',
    reviews: 'reviews.html',
    policies: 'policies.html',
  };
  const activeTarget = activeMap[page];
  if (activeTarget) {
    $$('.nav a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (href === activeTarget) link.setAttribute('aria-current', 'page');
    });
  }

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

function formatPrice(price, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(price || 0));
}

function normalizeSize(size) {
  const value = typeof size === 'object' && size ? size.label : size;
  return String(value || '').toUpperCase() === 'XXL' ? '2XL' : String(value || '').toUpperCase();
}

function sizeRank(size) {
  return SIZE_ORDER[normalizeSize(size)] ?? 99;
}

function sortSizes(sizes) {
  return [...new Set((sizes || []).map(normalizeSize).filter(Boolean))].sort((a, b) => sizeRank(a) - sizeRank(b));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));
}

function normalizeSizeStock(product) {
  const rawSizes = Array.isArray(product.sizes) ? product.sizes : [];
  const defaultStock = product.status === 'out_of_stock' ? 0 : 1;

  const records = rawSizes.map((entry) => {
    if (entry && typeof entry === 'object') {
      const label = normalizeSize(entry.label || entry.size || entry.name);
      const stock = Number.isFinite(Number(entry.stock)) ? Number(entry.stock) : defaultStock;
      return { label, stock: Math.max(0, stock) };
    }
    return { label: normalizeSize(entry), stock: defaultStock };
  }).filter((entry) => entry.label);

  records.sort((a, b) => sizeRank(a.label) - sizeRank(b.label));
  return records;
}

function availableSizeLabels(product) {
  return (product.sizeStock || [])
    .filter((item) => Number(item.stock) > 0)
    .map((item) => item.label);
}

function allSizeLabels(product) {
  return (product.sizeStock || []).map((item) => item.label);
}

function actualStock(value) {
  return Math.max(0, Number(value || 0));
}

function publicStock(value) {
  return Math.min(actualStock(value), PUBLIC_STOCK_CAP);
}

function publicStockText(stock) {
  const visible = publicStock(stock);
  if (visible <= 0) return 'Sold out';
  if (visible === 1) return '1 left';
  return `${visible} left`;
}

function totalStock(product) {
  return (product.sizeStock || []).reduce((sum, item) => sum + actualStock(item.stock), 0);
}

function totalPublicStock(product) {
  return (product.sizeStock || []).reduce((sum, item) => sum + publicStock(item.stock), 0);
}

function stockLabel(product) {
  const actual = totalStock(product);
  const visible = totalPublicStock(product);
  if (actual <= 0 || visible <= 0) return 'Sold out';
  if (visible === 1) return 'Only 1 left';
  if (visible <= 3) return `Only ${visible} left`;
  return 'Available now';
}

function sizeDisplay(product) {
  const items = product.sizeStock || [];
  if (!items.length) return 'Confirm on WhatsApp';
  return items.map((item) => item.stock > 0 ? item.label : `${item.label} sold out`).join(' · ');
}

async function loadProducts() {
  const response = await fetch('products.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Unable to load products.json');
  const products = await response.json();
  if (!Array.isArray(products)) throw new Error('products.json must contain an array');

  return products.map((product, index) => {
    const sizeStock = normalizeSizeStock(product);
    const computedStatus = sizeStock.some((item) => item.stock > 0) ? 'in_stock' : 'out_of_stock';
    return {
      ...product,
      sortIndex: index,
      status: computedStatus,
      sizeStock,
      sizes: sizeStock.map((item) => item.label),
      availableSizes: sizeStock.filter((item) => item.stock > 0).map((item) => item.label),
      category: product.category || 'F1 Jacket',
      videoUrls: product.videoUrls || [product.videoUrl, product.videoUrl2].filter(Boolean),
    };
  });
}

function statusLabel(status) {
  return status === 'out_of_stock' ? 'Sold out' : 'Available';
}

function statusClass(status) {
  return status === 'out_of_stock' ? 'is-out' : 'is-in';
}

function optionList(values, select) {
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function renderShop(products) {
  const grid = $('#productGrid');
  const empty = $('#emptyState');
  const resultCount = $('#resultCount');
  const search = $('#searchInput');
  const sizeFilter = $('#sizeFilter');
  const categoryFilter = $('#categoryFilter');
  const statusFilter = $('#statusFilter');
  const sortFilter = $('#sortFilter');
  const resetFilters = $('#resetFilters');

  if (!grid || !search || !sizeFilter || !categoryFilter || !statusFilter || !sortFilter) return;

  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
  optionList(sortSizes(products.flatMap((product) => allSizeLabels(product))), sizeFilter);
  optionList(categories, categoryFilter);


  if (resetFilters) {
    resetFilters.addEventListener('click', () => {
      search.value = '';
      sizeFilter.value = '';
      categoryFilter.value = '';
      statusFilter.value = '';
      sortFilter.value = 'featured';
      render();
      search.focus();
    });
  }

  const render = () => {
    const query = search.value.trim().toLowerCase();
    const selectedSize = sizeFilter.value;
    const selectedCategory = categoryFilter.value;
    const selectedStatus = statusFilter.value;
    const selectedSort = sortFilter.value;

    let items = products.filter((product) => {
      const haystack = [product.name, product.badge, product.type, product.category, stockLabel(product), ...allSizeLabels(product)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (!query || haystack.includes(query))
        && (!selectedSize || allSizeLabels(product).includes(selectedSize))
        && (!selectedCategory || product.category === selectedCategory)
        && (!selectedStatus || product.status === selectedStatus);
    });

    items = [...items].sort((a, b) => {
      if (selectedSort === 'price_asc') return Number(a.price) - Number(b.price);
      if (selectedSort === 'price_desc') return Number(b.price) - Number(a.price);
      if (selectedSort === 'name') return String(a.name).localeCompare(String(b.name));
      return Number(a.sortIndex) - Number(b.sortIndex);
    });

    grid.innerHTML = items.map((product) => {
      const mainImage = product.images?.[0] || '';
      const soldOut = product.status === 'out_of_stock';
      const availableSizes = availableSizeLabels(product).join(' · ') || 'Ask on WhatsApp';
      const allPreviewImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
      const hoverPreviewImages = allPreviewImages.slice(0, 3);
      const controls = allPreviewImages.length > 1
        ? `<button class="card-side-btn card-side-prev" type="button" data-image-prev aria-label="Previous product image">‹</button>
           <button class="card-side-btn card-side-next" type="button" data-image-next aria-label="Next product image">›</button>`
        : '';
      return `
        <a class="card ${soldOut ? 'card-disabled' : ''}" href="product.html?id=${encodeURIComponent(product.id)}" aria-label="View ${escapeHtml(product.name)}" data-card-images='${escapeHtml(JSON.stringify(allPreviewImages))}' data-card-hover-images='${escapeHtml(JSON.stringify(hoverPreviewImages))}'>
          <div class="card-media">
            <img class="card-media-image" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.name)}" loading="lazy" width="450" height="750">
            <span class="status-badge ${statusClass(product.status)}">${escapeHtml(soldOut ? 'Sold out' : stockLabel(product))}</span>
            ${controls}
            <span class="card-corner">View</span>
          </div>
          <div class="card-body">
            <div class="card-meta-row">
              <span class="card-kicker">${escapeHtml(product.category)}</span>
              <span class="mini-dot" aria-hidden="true"></span>
              <span class="card-size-note">${escapeHtml(availableSizes)}</span>
            </div>
            <h3 class="card-title">${escapeHtml(product.name)}</h3>
            <div class="card-bottom">
              <strong class="price">${formatPrice(product.price, product.currency)}</strong>
              <span class="badge ${soldOut ? '' : 'stock-badge'}">${escapeHtml(product.badge || product.type || 'Jacket')}</span>
            </div>
            <span class="card-action">View details</span>
          </div>
        </a>`;
    }).join('');

    bindProductCardPreviews(grid);

    if (empty) empty.hidden = items.length !== 0;
    if (resultCount) resultCount.textContent = `${items.length} of ${products.length} products`;
  };

  [search, sizeFilter, categoryFilter, statusFilter, sortFilter].forEach((control) => control.addEventListener('input', render));
  render();
}


function bindProductCardPreviews(grid) {
  const canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
  $$('.card[data-card-images]', grid).forEach((card) => {
    let images = [];
    let hoverImages = [];
    try { images = JSON.parse(card.dataset.cardImages || '[]'); } catch { images = []; }
    try { hoverImages = JSON.parse(card.dataset.cardHoverImages || '[]'); } catch { hoverImages = []; }
    if (!images || images.length < 2) return;
    if (!hoverImages || hoverImages.length < 2) hoverImages = images.slice(0, Math.min(3, images.length));

    const imageEl = $('.card-media-image', card);
    const media = $('.card-media', card);
    const prevBtn = $('[data-image-prev]', card);
    const nextBtn = $('[data-image-next]', card);
    let activeIndex = 0;
    let hoverIndex = 0;
    let hoverTimer = null;

    const setImage = (index) => {
      const nextIndex = (index + images.length) % images.length;
      activeIndex = nextIndex;
      if (imageEl) imageEl.src = images[nextIndex];
    };

    const setHoverImage = (index) => {
      const nextIndex = (index + hoverImages.length) % hoverImages.length;
      hoverIndex = nextIndex;
      if (imageEl) imageEl.src = hoverImages[nextIndex];
      const matchingIndex = images.indexOf(hoverImages[nextIndex]);
      if (matchingIndex >= 0) activeIndex = matchingIndex;
    };

    const stopHoverLoop = () => {
      if (hoverTimer) window.clearTimeout(hoverTimer);
      hoverTimer = null;
    };

    const scheduleHoverLoop = () => {
      const delay = hoverIndex === 0 ? 425 : 525;
      hoverTimer = window.setTimeout(() => {
        setHoverImage(hoverIndex + 1);
        scheduleHoverLoop();
      }, delay);
    };

    const startHoverLoop = () => {
      if (!canHover || !hoverImages.length || !media) return;
      stopHoverLoop();
      hoverIndex = 0;
      setHoverImage(0);
      scheduleHoverLoop();
    };

    const stopAndSet = (event, index) => {
      event.preventDefault();
      event.stopPropagation();
      stopHoverLoop();
      setImage(index);
    };

    prevBtn?.addEventListener('click', (event) => stopAndSet(event, activeIndex - 1));
    nextBtn?.addEventListener('click', (event) => stopAndSet(event, activeIndex + 1));

    if (canHover) {
      card.addEventListener('mouseenter', startHoverLoop);
      card.addEventListener('mouseleave', () => {
        stopHoverLoop();
        setImage(0);
      });
    }
  });
}

function productUrl(product) {
  const base = `${window.location.origin}${window.location.pathname.replace(/product\.html$/, '')}`;
  return `${base}product.html?id=${encodeURIComponent(product.id)}`;
}

function setMetaTag(selector, attributeName, attributeValue, content) {
  let tag = document.head.querySelector(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attributeName, attributeValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function updateProductMeta(product) {
  const title = `${product.name} — ${STORE_NAME}`;
  const description = `${product.name} - ${formatPrice(product.price, product.currency)}. ${stockLabel(product)}. Check sizes and order through WhatsApp.`;
  const image = product.images?.[0] ? new URL(product.images[0], window.location.href).href : '';
  const url = productUrl(product);

  document.title = title;
  setMetaTag('meta[name="description"]', 'name', 'description', description);
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', 'product');
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', url);
  if (image) setMetaTag('meta[property="og:image"]', 'property', 'og:image', image);
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
  if (image) setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', image);

  let schema = document.head.querySelector('script[data-product-schema]');
  if (!schema) {
    schema = document.createElement('script');
    schema.type = 'application/ld+json';
    schema.setAttribute('data-product-schema', 'true');
    document.head.appendChild(schema);
  }
  schema.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images?.map((src) => new URL(src, window.location.href).href) || [],
    description,
    brand: { '@type': 'Brand', name: STORE_NAME },
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency || 'INR',
      price: String(product.price || ''),
      availability: product.status === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url,
    },
  });
}

function sizeChartRows(sizes) {
  const chart = {
    S: ['66', '54', '62', '46'],
    M: ['68', '56', '64', '48'],
    L: ['70', '58', '66', '50'],
    XL: ['75', '63', '70', '53'],
    '2XL': ['80', '66', '74', '58'],
    '3XL': ['82', '68', '76', '60'],
    '4XL': ['84', '70', '78', '62'],
    '5XL': ['86', '72', '80', '64'],
  };
  const rows = sortSizes(sizes || []).filter((size) => chart[size]);
  const useRows = rows.length ? rows : ['M', 'L', 'XL', '2XL'];
  return useRows.map((size) => `<tr><td>${size}</td><td>${chart[size][0]}</td><td>${chart[size][1]}</td><td>${chart[size][2]}</td><td>${chart[size][3]}</td></tr>`).join('');
}

function renderProduct(products) {
  const app = $('#productApp');
  if (!app) return;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const product = products.find((item) => item.id === id);

  if (!product) {
    document.title = `Product not found — ${STORE_NAME}`;
    app.innerHTML = `
      <div class="not-found">
        <p class="eyebrow">Product not found</p>
        <h1>This product link is not available.</h1>
        <p>The item may have been removed or renamed. Please return to the shop and select an available product.</p>
        <a class="btn btn-primary" href="index.html">Back to shop</a>
      </div>`;
    return;
  }

  updateProductMeta(product);

  const images = product.images || [];
  const videos = product.videoUrls || [];
  const isOut = product.status === 'out_of_stock' || totalStock(product) <= 0;
  const firstAvailableSize = availableSizeLabels(product)[0] || '';
  const sizesHtml = (product.sizeStock || []).map((item) => {
    const actual = actualStock(item.stock);
    const visible = publicStock(actual);
    const disabled = isOut || actual <= 0;
    const active = item.label === firstAvailableSize && !disabled;
    const stockText = visible <= 0 ? 'Sold out' : (visible === 1 ? '1 left' : `${visible} left`);
    return `
      <button class="chip ${active ? 'active' : ''}" type="button" data-size="${escapeHtml(item.label)}" data-stock="${visible}" aria-pressed="${active ? 'true' : 'false'}" ${disabled ? 'disabled' : ''}>
        <span>${escapeHtml(item.label)}</span>
        <small>${escapeHtml(stockText)}</small>
      </button>`;
  }).join('');

  app.innerHTML = `
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="index.html">Shop</a><span>/</span><span>${escapeHtml(product.name)}</span></nav>
    <section class="product-layout">
      <div class="gallery">
        <div class="main-image-shell">
          <div class="main-image" id="mainMedia"></div>
          ${(images.length + videos.length) > 1 ? `
            <button class="gallery-side-btn gallery-side-prev" id="galleryPrevBtn" type="button" aria-label="Previous product image">‹</button>
            <button class="gallery-side-btn gallery-side-next" id="galleryNextBtn" type="button" aria-label="Next product image">›</button>` : ''}
        </div>
        <div class="thumbs" id="thumbs" aria-label="Product media thumbnails"></div>
      </div>
      <div class="product-panel">
        <div class="product-tags">
          <span class="status-badge ${statusClass(product.status)}">${statusLabel(product.status)}</span>
          <span class="badge">${escapeHtml(product.badge || product.category || 'Jacket')}</span>
          <span class="badge stock-badge">${escapeHtml(stockLabel(product))}</span>
        </div>
        <h1 class="product-title">${escapeHtml(product.name)}</h1>
        <div class="price product-price">${formatPrice(product.price, product.currency)}</div>
        <p class="product-desc">${escapeHtml(product.description || 'Motorsport-inspired outerwear with a clean teamwear look.')}</p>
        <section class="selector-block">
          <div class="selector-heading"><strong>Choose size</strong><span>Customer stock is shown up to 3 per size</span></div>
          <div class="chips" id="sizeChips">${sizesHtml || '<span class="muted">Confirm size on WhatsApp</span>'}</div>
          <div class="size-warning">Sizes can vary by jacket. Compare the measurements with a jacket that fits you well before confirming.</div>
        </section>

        <div class="checkout-row checkout-row-simple">
          <label class="qty"><span>Quantity</span><input id="qty" type="number" min="1" value="1" ${isOut ? 'disabled' : ''}></label>
        </div>
        <p class="qty-hint" id="qtyHint"></p>

        <div class="product-actions">
          <button class="btn btn-primary" id="buyBtn" type="button" ${isOut ? 'disabled' : ''}>Buy on WhatsApp</button>
          <button class="btn btn-ghost" id="shareBtn" type="button">Share product</button>
          <a class="btn btn-ghost" href="index.html">← Back to shop</a>
        </div>

        <section class="sizechart" aria-label="Size chart">
          <h2>Size chart <small>(cm)</small></h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Size</th><th>Length</th><th>Chest</th><th>Sleeve</th><th>Shoulder</th></tr></thead>
            <tbody>${sizeChartRows(product.sizes)}</tbody>
          </table></div>
          <figure class="size-guide">
            <img src="assets/size-guide-chest.webp" loading="lazy" alt="How to measure jacket length, chest, sleeve and shoulder" width="512" height="512">
            <figcaption><strong>How to measure:</strong> Length is shoulder to hem. Chest is pit-to-pit. Sleeve is shoulder seam to cuff. Shoulder is seam-to-seam.</figcaption>
          </figure>
        </section>

        <section class="order-info" aria-label="Delivery and return summary">
          <article><span class="info-icon">🚚</span><strong>Delivery</strong><span>Courier timeline and serviceability are confirmed before dispatch.</span></article>
          <article><span class="info-icon">💳</span><strong>Payment</strong><span>COD, UPI and bank transfer options are confirmed on WhatsApp.</span></article>
          <article><span class="info-icon">📏</span><strong>Size help</strong><span>Compare the chart with a jacket that already fits you well.</span></article>
          <article><span class="info-icon">🔁</span><strong>Support</strong><span>Exchange or return support follows the delivery terms.</span></article>
        </section>
      </div>
    </section>
    <div class="sticky-order-bar" aria-label="Quick WhatsApp order">
      <div><strong>${formatPrice(product.price, product.currency)}</strong><span id="stickyStockText">${escapeHtml(stockLabel(product))}</span></div>
      <button class="btn btn-primary" id="stickyBuyBtn" type="button" ${isOut ? 'disabled' : ''}>Order on WhatsApp</button>
    </div>
    <div class="video-modal" id="videoModal" hidden aria-hidden="true">
      <div class="video-modal-backdrop" data-video-close></div>
      <section class="video-modal-panel" role="dialog" aria-modal="true" aria-label="Product video">
        <button class="video-modal-close" type="button" data-video-close aria-label="Close video">×</button>
        <div class="video-modal-content" id="videoModalContent"></div>
      </section>
    </div>`;

  const mainMedia = $('#mainMedia');
  const mainImageShell = $('.main-image-shell');
  const thumbs = $('#thumbs');
  const galleryPrevBtn = $('#galleryPrevBtn');
  const galleryNextBtn = $('#galleryNextBtn');
  const qty = $('#qty');
  const qtyHint = $('#qtyHint');
  const stickyStockText = $('#stickyStockText');
  const mediaItems = [
    ...images.map((src) => ({ type: 'image', src })),
    ...videos.map((src) => ({ type: 'video', src })),
  ];
  let mediaIndex = 0;
  let selectedSize = isOut ? '' : firstAvailableSize;

  function selectedRecord() {
    return (product.sizeStock || []).find((item) => item.label === selectedSize);
  }

  function updateQuantityLimit() {
    const record = selectedRecord();
    const visibleStock = publicStock(record?.stock || 0);
    if (!qty) return;
    if (!selectedSize || visibleStock <= 0) {
      qty.value = '1';
      qty.removeAttribute('max');
      if (qtyHint) qtyHint.textContent = 'Select an available size to order.';
      if (stickyStockText) stickyStockText.textContent = 'Select size';
      return;
    }
    qty.max = String(visibleStock);
    if (Number(qty.value || 1) > visibleStock) qty.value = String(visibleStock);
    if (Number(qty.value || 1) < 1) qty.value = '1';
    const message = visibleStock === 1 ? 'Maximum quantity for this size: 1' : `Maximum quantity for this size: ${visibleStock}`;
    if (qtyHint) qtyHint.textContent = message;
    if (stickyStockText) stickyStockText.textContent = `${selectedSize} · ${visibleStock === 1 ? '1 left' : `${visibleStock} left`}`;
  }

  function driveFileId(src) {
    const match = String(src || '').match(/\/d\/([^/]+)/) || String(src || '').match(/[?&]id=([^&]+)/);
    return match ? match[1] : '';
  }

  function cleanVideoSource(src) {
    const id = driveFileId(src);
    if (id) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
    return src;
  }

  function videoEmbedHtml(src) {
    const cleanSrc = cleanVideoSource(src);
    return `
      <div class="custom-video-player" data-video-player data-original-video="${escapeHtml(src)}">
        <video class="custom-video" src="${escapeHtml(cleanSrc)}" playsinline preload="metadata"></video>
        <div class="custom-video-error" hidden>Video could not load in the clean player. Please check the Drive sharing permission.</div>
        <div class="custom-video-bar" aria-label="Video controls">
          <button class="custom-video-btn" type="button" data-video-toggle aria-label="Play video">▶</button>
          <input class="custom-video-progress" type="range" min="0" max="100" value="0" step="0.1" data-video-progress aria-label="Video progress">
          <span class="custom-video-time" data-video-time>0:00 / 0:00</span>
          <button class="custom-video-btn" type="button" data-video-mute aria-label="Mute video">🔊</button>
        </div>
      </div>`;
  }

  function bindCustomVideoPlayer(scope) {
    const player = $('[data-video-player]', scope);
    if (!player) return;
    const video = $('.custom-video', player);
    const toggle = $('[data-video-toggle]', player);
    const progress = $('[data-video-progress]', player);
    const time = $('[data-video-time]', player);
    const mute = $('[data-video-mute]', player);
    const error = $('.custom-video-error', player);
    if (!video || !toggle || !progress || !time) return;

    const fmt = (seconds) => {
      const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
      const m = Math.floor(value / 60);
      const s = Math.floor(value % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    const update = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      progress.value = duration ? String((video.currentTime / duration) * 100) : '0';
      time.textContent = `${fmt(video.currentTime)} / ${fmt(duration)}`;
      toggle.textContent = video.paused ? '▶' : 'Ⅱ';
      toggle.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
      if (mute) mute.textContent = video.muted ? '🔇' : '🔊';
    };

    toggle.addEventListener('click', async () => {
      try {
        if (video.paused) await video.play();
        else video.pause();
      } catch {
        if (error) error.hidden = false;
      }
      update();
    });

    video.addEventListener('click', () => toggle.click());
    video.addEventListener('loadedmetadata', update);
    video.addEventListener('timeupdate', update);
    video.addEventListener('play', update);
    video.addEventListener('pause', update);
    video.addEventListener('ended', update);
    video.addEventListener('error', () => { if (error) error.hidden = false; });

    progress.addEventListener('input', () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (duration) video.currentTime = (Number(progress.value) / 100) * duration;
      update();
    });

    mute?.addEventListener('click', () => {
      video.muted = !video.muted;
      update();
    });

    update();
  }

  function setMainImage(src) {
    mainMedia.classList.remove('media-video', 'media-video-link');
    mainMedia.classList.add('media-image');
    mainImageShell?.classList.remove('media-is-video');
    mainMedia.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)}" loading="eager">`;
  }

  function openVideoModal(src) {
    const modal = $('#videoModal');
    const content = $('#videoModalContent');
    if (!modal || !content) return;
    content.innerHTML = videoEmbedHtml(src, true);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('video-modal-open');
    $('.video-modal-close', modal)?.focus();
  }

  function closeVideoModal() {
    const modal = $('#videoModal');
    const content = $('#videoModalContent');
    if (!modal || !content) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    content.innerHTML = '';
    document.body.classList.remove('video-modal-open');
  }

  function setMainVideo(src) {
    mainMedia.classList.remove('media-image', 'media-video-link');
    mainMedia.classList.add('media-video');
    mainImageShell?.classList.add('media-is-video');
    mainMedia.innerHTML = videoEmbedHtml(src);
    bindCustomVideoPlayer(mainMedia);
  }

  function activateThumb(thumb) {
    if (!thumb) return;
    $$('.thumb', thumbs).forEach((item) => item.classList.remove('active'));
    thumb.classList.add('active');
  }

  function showMediaAt(index) {
    if (!mediaItems.length) return;
    mediaIndex = (index + mediaItems.length) % mediaItems.length;
    const item = mediaItems[mediaIndex];
    activateThumb($$('.thumb', thumbs)[mediaIndex]);
    if (item.type === 'video') setMainVideo(item.src);
    else setMainImage(item.src);
  }

  images.forEach((src, index) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = `thumb ${index === 0 ? 'active' : ''}`;
    thumb.innerHTML = `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} image ${index + 1}" loading="lazy">`;
    thumb.addEventListener('click', () => showMediaAt(index));
    thumbs.appendChild(thumb);
  });

  videos.forEach((src, index) => {
    const thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'thumb video-thumb';
    thumb.innerHTML = `${images[0] ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)} video" loading="lazy">` : ''}<span class="play">▶</span><span class="thumb-label">Video ${index + 1}</span>`;
    thumb.addEventListener('click', () => showMediaAt(images.length + index));
    thumbs.appendChild(thumb);
  });

  galleryPrevBtn?.addEventListener('click', () => showMediaAt(mediaIndex - 1));
  galleryNextBtn?.addEventListener('click', () => showMediaAt(mediaIndex + 1));
  $$('[data-video-close]').forEach((button) => button.addEventListener('click', closeVideoModal));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeVideoModal();
  });

  if (mediaItems.length) showMediaAt(0);
  else mainMedia.innerHTML = '<div class="empty-state">No image available</div>';

  $$('#sizeChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedSize = chip.dataset.size;
      $$('#sizeChips .chip').forEach((item) => {
        item.classList.remove('active');
        item.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      updateQuantityLimit();
    });
  });

  if (qty) {
    qty.addEventListener('input', updateQuantityLimit);
    qty.addEventListener('change', updateQuantityLimit);
  }
  updateQuantityLimit();

  function openWhatsAppOrder() {
    if (isOut) return;
    if (!selectedSize) {
      alert('Please select an available size before ordering.');
      return;
    }

    const record = selectedRecord();
    const visibleStock = publicStock(record?.stock || 0);
    let quantity = Math.max(1, Number(qty?.value || 1));
    if (visibleStock > 0 && quantity > visibleStock) {
      quantity = visibleStock;
      if (qty) qty.value = String(visibleStock);
      alert(`Only ${visibleStock} piece${visibleStock === 1 ? '' : 's'} available in ${selectedSize}. Quantity has been updated.`);
      return;
    }

    const message = [
      'Hi, I want to order this item:',
      '',
      `Product: ${product.name}`,
      `Size: ${selectedSize}`,
      `Quantity: ${quantity}`,
      `Price: ${formatPrice(product.price, product.currency)}`,
      `Stock shown: ${visibleStock > 0 ? (visibleStock === 1 ? 'Only 1 left' : `${visibleStock} available`) : 'Confirm on WhatsApp'}`,
      `Product link: ${productUrl(product)}`,
      '',
      'Please confirm availability, delivery details and payment option.',
    ].join('\n');

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  }

  async function shareProduct() {
    const shareData = {
      title: `${product.name} — ${STORE_NAME}`,
      text: `${product.name} - ${formatPrice(product.price, product.currency)}. ${stockLabel(product)}.`,
      url: productUrl(product),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        alert('Product link copied.');
      } else {
        prompt('Copy product link:', shareData.url);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') alert('Could not share this product. Please copy the page link manually.');
    }
  }

  $('#buyBtn')?.addEventListener('click', openWhatsAppOrder);
  $('#stickyBuyBtn')?.addEventListener('click', openWhatsAppOrder);
  $('#shareBtn')?.addEventListener('click', shareProduct);
}

async function boot() {
  setYear();
  setupNav();
  const page = document.body.dataset.page;
  if (!['shop', 'product'].includes(page)) return;
  try {
    const products = await loadProducts();
    if (page === 'shop') renderShop(products);
    if (page === 'product') renderProduct(products);
  } catch (error) {
    const target = page === 'shop' ? $('#productGrid') : $('#productApp');
    if (target) {
      target.innerHTML = `<div class="error-card"><h2>Could not load products</h2><p>${escapeHtml(error.message)}. Run this site through a local server or deploy it online so products.json can be loaded.</p></div>`;
    }
    const count = $('#resultCount');
    if (count) count.textContent = 'Products unavailable';
  }
}

document.addEventListener('DOMContentLoaded', boot);
