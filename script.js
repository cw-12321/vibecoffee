// ==============================================================================
// 바이브 커피 (Vibe Coffee) 주문서 & 주문 내역 관리 스크립트
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {

  // ----------------------------------------------------------------------------
  // 1. 필요한 HTML 요소(DOM) 가져오기
  // ----------------------------------------------------------------------------
  // 탭 네비게이션 버튼 및 섹션
  const tabOrderBtn = document.getElementById('tabOrderBtn');
  const tabHistoryBtn = document.getElementById('tabHistoryBtn');
  const orderTabSection = document.getElementById('orderTabSection');
  const historyTabSection = document.getElementById('historyTabSection');
  const orderCountBadge = document.getElementById('orderCountBadge');

  // 주문 폼 요소
  const orderForm = document.getElementById('orderForm');
  const customerName = document.getElementById('customerName');
  const phoneNumber = document.getElementById('phoneNumber');
  const requestsInput = document.getElementById('requests');

  // 선택 중인 음료 옵션 필드들
  const beverageSelect = document.getElementById('beverage');
  const sizeRadios = document.querySelectorAll('input[name="size"]');
  const optionCheckboxes = document.querySelectorAll('input[name="option"]');
  const quantityInput = document.getElementById('quantity');

  // 담기 버튼 및 장바구니 목록 영역
  const addToCartBtn = document.getElementById('addToCartBtn');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartCount = document.getElementById('cartCount');

  // 예상 금액 및 주문 확인 영역
  const totalPriceSpan = document.getElementById('totalPrice');
  const orderConfirmation = document.getElementById('orderConfirmation');

  // 음료 컵 시각화 미리보기 위젯
  const drinkPreviewContainer = document.getElementById('drinkPreviewContainer');
  const drinkPreviewList = document.getElementById('drinkPreviewList');
  const previewTitle = document.getElementById('previewTitle');
  const previewBadge = document.getElementById('previewBadge');

  // 주문 내역 탭 요소들
  const ordersList = document.getElementById('ordersList');
  const historySummary = document.getElementById('historySummary');
  const totalOrdersSummary = document.getElementById('totalOrdersSummary');

  // ----------------------------------------------------------------------------
  // Supabase 클라이언트 설정 (초보자용 안내)
  // CDN으로 가져온 supabase 라이브러리를 사용해 클라이언트 인스턴스를 생성합니다.
  // 변수명: supabaseClient
  // ----------------------------------------------------------------------------
  const SUPABASE_URL = 'https://wxxlidtqorkxdxwidjld.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4eGxpZHRxb3JreGR4d2lkamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzkzODEsImV4cCI6MjEwNjgxNTM4MX0.ITjvs0e9p6bczOAaGq4KLfYV901vp4vUkDxLUcxzDtc';

  // window.supabase 전역 객체 확인 후 supabaseClient 생성
  let supabaseClient = null;
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // ----------------------------------------------------------------------------
  // 2. 상태 관리 배열 및 로컬스토리지 복원 (사용자 편의성: 새로고침 방지)
  // ----------------------------------------------------------------------------
  let cart = []; // 현재 작성 중인 장바구니 목록

  // 로컬스토리지에서 이전 주문 내역 불러오기
  const STORAGE_KEY = 'vibe_coffee_orders';
  let orders = [];
  try {
    const savedOrders = localStorage.getItem(STORAGE_KEY);
    if (savedOrders) {
      orders = JSON.parse(savedOrders);
    }
  } catch (err) {
    console.error('로컬스토리지 불러오기 오류:', err);
    orders = [];
  }

  // 다음 주문 번호 계산 (기존 주문 중 가장 큰 주문번호 + 1, 없으면 1)
  let nextOrderNumber = orders.length > 0 
    ? Math.max(...orders.map(o => o.orderNumber || 0)) + 1 
    : 1;

  /**
   * 주문 목록을 로컬스토리지에 안전하게 동기화 저장하는 도우미 함수
   */
  function saveOrdersToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch (err) {
      console.error('로컬스토리지 저장 실패:', err);
    }
  }

  // ----------------------------------------------------------------------------
  // 2-1. 사용자 편의성: 전화번호 자동 하이픈(-) 포맷팅
  // ----------------------------------------------------------------------------
  phoneNumber.addEventListener('input', (e) => {
    // 숫자 이외의 문자 제거
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 11) {
      val = val.substring(0, 11);
    }

    // 010-XXXX-XXXX 형식으로 변환
    if (val.length >= 4 && val.length <= 7) {
      val = val.replace(/(\d{3})(\d{1,4})/, '$1-$2');
    } else if (val.length >= 8) {
      val = val.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    }
    e.target.value = val;
  });

  // ----------------------------------------------------------------------------
  // 3. 탭 전환 기능 (주문하기 ↔ 📋 주문 내역)
  // ----------------------------------------------------------------------------
  function switchTab(targetTab) {
    if (targetTab === 'order') {
      tabOrderBtn.classList.add('active');
      tabHistoryBtn.classList.remove('active');
      orderTabSection.classList.remove('hidden');
      historyTabSection.classList.add('hidden');
    } else {
      tabHistoryBtn.classList.add('active');
      tabOrderBtn.classList.remove('active');
      historyTabSection.classList.remove('hidden');
      orderTabSection.classList.add('hidden');
      renderOrders();
    }
  }

  tabOrderBtn.addEventListener('click', () => switchTab('order'));
  tabHistoryBtn.addEventListener('click', () => switchTab('history'));

  // ----------------------------------------------------------------------------
  // 4. 현재 폼에서 선택 중인 "현재 음료 구성(Draft)" 계산 함수
  // ----------------------------------------------------------------------------
  function getCurrentDraftDrink() {
    const beverageValue = beverageSelect.value;
    if (!beverageValue) return null;

    const selectedOption = beverageSelect.options[beverageSelect.selectedIndex];
    const beverageName = selectedOption.text.split(' ')[0] || selectedOption.text;
    const beveragePrice = Number(selectedOption.dataset.price || 0);

    const checkedSize = document.querySelector('input[name="size"]:checked');
    const sizeName = checkedSize ? checkedSize.value : 'S';
    const sizePrice = Number(checkedSize?.dataset.price || 0);

    const options = [];
    let optionsPrice = 0;
    let hasCream = false;

    optionCheckboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        const labelText = checkbox.nextElementSibling.textContent.trim();
        const optTitle = labelText.split(' (')[0];
        options.push(optTitle);
        optionsPrice += Number(checkbox.dataset.price || 0);
        if (checkbox.value === 'cream') hasCream = true;
      }
    });

    const quantity = Math.max(1, parseInt(quantityInput.value, 10) || 1);
    const unitPrice = beveragePrice + sizePrice + optionsPrice;
    const itemTotal = unitPrice * quantity;

    return {
      beverageKey: beverageValue,
      beverageName,
      size: sizeName,
      options,
      hasCream,
      quantity,
      unitPrice,
      itemTotal
    };
  }

  // ----------------------------------------------------------------------------
  // 5. 전체 총 금액 계산 함수: calculateTotal()
  // ----------------------------------------------------------------------------
  function calculateTotal() {
    const cartTotal = cart.reduce((sum, item) => sum + item.itemTotal, 0);
    const currentDraft = getCurrentDraftDrink();
    const draftTotal = currentDraft ? currentDraft.itemTotal : 0;
    const grandTotal = cartTotal + draftTotal;

    totalPriceSpan.textContent = grandTotal.toLocaleString();
    return grandTotal;
  }

  // ----------------------------------------------------------------------------
  // 6. 음료 시각화 미리보기 업데이트 함수: updateDrinkPreview()
  // ----------------------------------------------------------------------------
  function updateDrinkPreview() {
    drinkPreviewList.innerHTML = '';

    const currentDraft = getCurrentDraftDrink();
    const hasCart = cart.length > 0;
    const hasDraft = currentDraft !== null;

    if (hasCart && hasDraft) {
      previewTitle.textContent = '🥤 담긴 음료 + 지금 고른 음료';
      previewBadge.textContent = '담긴 음료 & 선택 중';
    } else if (hasCart) {
      previewTitle.textContent = '🥤 담긴 음료 목록 미리보기';
      previewBadge.textContent = `${cart.reduce((s, i) => s + i.quantity, 0)}잔 담김`;
    } else if (hasDraft) {
      previewTitle.textContent = '🥤 현재 선택 중인 음료';
      previewBadge.textContent = '선택 중';
    } else {
      previewTitle.textContent = '🥤 음료 미리보기';
      previewBadge.textContent = '대기 중';
    }

    if (!hasCart && !hasDraft) {
      drinkPreviewList.innerHTML = '<p class="preview-empty-hint">음료를 선택하시면 이곳에 잔 일러스트가 실시간으로 나타납니다.</p>';
      return;
    }

    let cupCount = 0;

    // 1) 담긴 음료 렌더링
    cart.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        cupCount++;
        const cupItem = document.createElement('div');
        cupItem.className = 'cup-item';
        cupItem.innerHTML = `
          <div class="cup-graphic size-${item.size.toLowerCase()}" title="${item.beverageName} (${item.size})">
            <div class="cup-straw"></div>
            ${item.hasCream ? '<div class="cup-cream"></div>' : ''}
            <div class="cup-liquid liquid-${item.beverageKey}"></div>
          </div>
          <span class="cup-number">${cupCount}번 잔</span>
        `;
        drinkPreviewList.appendChild(cupItem);
      }
    });

    // 2) 현재 추가 중인 음료 렌더링
    if (hasDraft) {
      for (let i = 0; i < currentDraft.quantity; i++) {
        cupCount++;
        const draftCup = document.createElement('div');
        draftCup.className = 'cup-item draft-cup';
        draftCup.innerHTML = `
          <div class="cup-graphic size-${currentDraft.size.toLowerCase()}" title="[선택 중] ${currentDraft.beverageName} (${currentDraft.size})">
            <div class="cup-straw"></div>
            ${currentDraft.hasCream ? '<div class="cup-cream"></div>' : ''}
            <div class="cup-liquid liquid-${currentDraft.beverageKey}"></div>
          </div>
          <span class="cup-number draft-number">${hasCart ? '추가 중' : `${cupCount}번 잔`}</span>
        `;
        drinkPreviewList.appendChild(draftCup);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 7. 장바구니 UI 렌더링 함수: renderCart()
  // ----------------------------------------------------------------------------
  function renderCart() {
    const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItemsCount;

    if (cart.length === 0) {
      cartItemsList.innerHTML = '<p class="empty-cart-msg">담긴 음료가 없습니다. 음료를 골라 담아보세요!</p>';
    } else {
      cartItemsList.innerHTML = '';
      cart.forEach((item) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';

        const optStr = item.options.length > 0 ? ` [${item.options.join(', ')}]` : '';

        itemEl.innerHTML = `
          <div class="cart-item-info">
            <div class="cart-item-title">${item.beverageName} (${item.size}사이즈) × ${item.quantity}잔</div>
            <div class="cart-item-options">${optStr ? '옵션: ' + item.options.join(', ') : '기본 옵션'}</div>
          </div>
          <div class="cart-item-price">${item.itemTotal.toLocaleString()}원</div>
          <button type="button" class="cart-item-delete" data-id="${item.id}" title="삭제">✕</button>
        `;

        cartItemsList.appendChild(itemEl);
      });
    }

    calculateTotal();
    updateDrinkPreview();
  }

  // ----------------------------------------------------------------------------
  // 8. [이 음료 담기] 버튼 클릭 이벤트
  // ----------------------------------------------------------------------------
  addToCartBtn.addEventListener('click', () => {
    if (!beverageSelect.value) {
      alert('담으실 음료를 먼저 선택해주세요.');
      beverageSelect.focus();
      return;
    }

    const draft = getCurrentDraftDrink();
    if (!draft) return;

    cart.push({
      id: Date.now() + Math.random().toString(36).substring(2, 5),
      ...draft
    });

    addToCartBtn.textContent = '✓ 담기 완료!';
    addToCartBtn.style.backgroundColor = '#2e7d32';
    setTimeout(() => {
      addToCartBtn.textContent = '+ 이 음료 담기';
      addToCartBtn.style.backgroundColor = '';
    }, 600);

    // 다음 음료를 편하게 고를 수 있도록 음료 옵션만 초기화
    beverageSelect.value = '';
    const sizeS = document.getElementById('sizeS');
    if (sizeS) sizeS.checked = true;
    optionCheckboxes.forEach((chk) => (chk.checked = false));
    quantityInput.value = 1;

    renderCart();
  });

  // 장바구니 개별 품목 삭제
  cartItemsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('cart-item-delete')) {
      const deleteId = e.target.dataset.id;
      cart = cart.filter((item) => item.id !== deleteId);
      renderCart();
    }
  });

  // 폼 입력 실시간 변경 감지
  function onFormChange() {
    calculateTotal();
    updateDrinkPreview();
  }

  beverageSelect.addEventListener('change', onFormChange);
  sizeRadios.forEach((radio) => radio.addEventListener('change', onFormChange));
  optionCheckboxes.forEach((checkbox) => checkbox.addEventListener('change', onFormChange));
  quantityInput.addEventListener('input', onFormChange);

  // ----------------------------------------------------------------------------
  // 9. 주문 내역 목록 그리는 단일 함수: renderOrders()
  // 보안을 위해 textContent 사용
  // ----------------------------------------------------------------------------
  function renderOrders() {
    orderCountBadge.textContent = orders.length;

    if (orders.length === 0) {
      ordersList.innerHTML = '<div class="empty-history-msg">아직 주문 내역이 없어요 ☕</div>';
      historySummary.classList.add('hidden');
      return;
    }

    historySummary.classList.remove('hidden');
    const grandSum = orders.reduce((sum, ord) => sum + ord.price, 0);
    totalOrdersSummary.textContent = `총 주문 금액: ${grandSum.toLocaleString()}원 (${orders.length}건)`;

    ordersList.innerHTML = '';

    orders.forEach((order) => {
      const card = document.createElement('div');
      card.className = 'order-history-card';

      const rowTop = document.createElement('div');
      rowTop.className = 'card-row-top';

      const titleInfo = document.createElement('span');
      titleInfo.className = 'order-title-info';
      titleInfo.textContent = `#${order.orderNumber} ${order.name}님 · ${order.price.toLocaleString()}원`;

      // 1줄: 주문 기본 정보 추가 (삭제/취소 버튼 제거됨)
      rowTop.appendChild(titleInfo);

      const rowDetail = document.createElement('div');
      rowDetail.className = 'order-items-detail';
      rowDetail.textContent = order.detail;

      const rowMeta = document.createElement('div');
      rowMeta.className = 'order-meta-info';

      if (order.requests) {
        const reqTag = document.createElement('span');
        reqTag.className = 'order-request-tag';
        reqTag.textContent = `요청: ${order.requests}`;
        rowMeta.appendChild(reqTag);
      }

      const timeSpan = document.createElement('span');
      timeSpan.className = 'order-time';
      timeSpan.textContent = `주문 시간: ${order.time}`;
      rowMeta.appendChild(timeSpan);

      card.appendChild(rowTop);
      card.appendChild(rowDetail);
      card.appendChild(rowMeta);

      ordersList.appendChild(card);
    });
  }

  const clearAllOrdersBtn = document.getElementById('clearAllOrdersBtn');

  // ----------------------------------------------------------------------------
  // 10. 주문 내역 지우기 (로컬 내역만 초기화, Supabase에 전송된 내역은 유지)
  // ----------------------------------------------------------------------------
  if (clearAllOrdersBtn) {
    clearAllOrdersBtn.addEventListener('click', () => {
      if (orders.length === 0) {
        alert('지울 주문 내역이 없습니다.');
        return;
      }

      const confirmed = confirm('화면의 주문 내역을 모두 지우시겠습니까?\n(이미 접수 및 서버에 저장된 주문 내역은 안전하게 보존됩니다.)');
      if (confirmed) {
        orders = [];
        saveOrdersToStorage();
        renderOrders();
        alert('주문 내역이 정리되었습니다.');
      }
    });
  }

  // ----------------------------------------------------------------------------
  // 11. 주문하기 (Submit) 이벤트 처리 - 즉시 Supabase 저장 & 로컬 동기화
  // ----------------------------------------------------------------------------
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1) 이름 검사
    const name = customerName.value.trim();
    if (!name) {
      alert('이름을 입력해주세요');
      customerName.focus();
      return;
    }

    // 2) 전화번호 유효성 검사 (입력된 경우에만 형식 검증)
    const phoneVal = phoneNumber.value.trim();
    if (phoneVal) {
      // 01X-XXXX-XXXX 또는 01X-XXX-XXXX 정규식 검사
      const phoneRegex = /^01[016789]-\d{3,4}-\d{4}$/;
      if (!phoneRegex.test(phoneVal)) {
        alert('올바른 휴대폰 번호 형식을 입력해주세요.\n(예: 010-1234-5678)');
        phoneNumber.focus();
        return;
      }
    }

    // 3) 장바구니 확인 (장바구니가 비어있고 현재 폼에 골라둔 음료가 있다면 자동 담기)
    if (cart.length === 0) {
      if (beverageSelect.value) {
        const draft = getCurrentDraftDrink();
        cart.push({
          id: Date.now().toString(),
          ...draft
        });
        renderCart();
      } else {
        alert('주문하실 음료를 선택하여 담아주세요!');
        beverageSelect.focus();
        return;
      }
    } else if (beverageSelect.value) {
      const confirmAdd = confirm('선택하신 음료가 아직 담기지 않았습니다. 이 음료도 함께 포함하여 주문하시겠습니까?');
      if (confirmAdd) {
        const draft = getCurrentDraftDrink();
        cart.push({
          id: Date.now().toString(),
          ...draft
        });
        renderCart();
      }
    }

    // 4) 주문 금액 및 세부 내역 생성
    const totalAmount = calculateTotal();
    const totalCupCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const itemsDetail = cart.map((item) => {
      const opt = item.options.length > 0 ? ` (${item.options.join(', ')})` : '';
      return `${item.beverageName} ${item.size}사이즈${opt} ${item.quantity}잔`;
    }).join(', ');

    const now = new Date();
    const formattedTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const thisOrderNumber = nextOrderNumber++;

    // 5) newOrder 객체 생성
    const newOrder = {
      orderNumber: thisOrderNumber,
      name: name,
      phone: phoneVal,
      beverage: cart.map(i => i.beverageName).join(', '),
      size: cart.map(i => i.size).join(', '),
      options: cart.map(i => i.options.join(', ')).filter(Boolean).join(' / '),
      quantity: totalCupCount,
      requests: requestsInput.value.trim(),
      price: totalAmount,
      time: formattedTime,
      detail: itemsDetail
    };

    // 6) 저장하는 동안 주문하기 버튼 비활성화 (두 번 눌림 방지)
    const submitBtn = document.getElementById('submitBtn');
    const originalSubmitText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '주문 저장 중...';

    // 7) Supabase에 바로 저장 (INSERT) 시도
    let isSaveSuccess = false;

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('orders')
          .insert([{
            order_number: newOrder.orderNumber,
            customer_name: newOrder.name,
            phone: newOrder.phone || '',
            items_detail: newOrder.detail,
            quantity: newOrder.quantity,
            requests: newOrder.requests || '',
            total_price: newOrder.price,
            order_time: newOrder.time
          }]);

        if (error) {
          console.error('[Supabase 저장 오류]', error);
          alert('주문 저장에 실패했어요');
        } else {
          isSaveSuccess = true;
          console.log(`[Supabase 저장 완료] 주문번호 #${newOrder.orderNumber}`);
        }
      } catch (err) {
        console.error('[Supabase 통신 오류]', err);
        alert('주문 저장에 실패했어요');
      }
    } else {
      console.warn('supabaseClient가 설정되지 않았습니다.');
    }

    // 통신 완료 후 버튼 활성화 복구
    submitBtn.disabled = false;
    submitBtn.textContent = originalSubmitText;

    // 8) orders 배열에 추가 및 로컬스토리지 저장 (새로고침해도 보존)
    orders.unshift(newOrder);
    saveOrdersToStorage();
    renderOrders();

    // 9) 저장 성공 시 주문 확인 메시지 표시
    if (isSaveSuccess || !supabaseClient) {
      const orderMessage = `${name}님, ${itemsDetail}, 총 ${totalAmount.toLocaleString()}원 (${totalCupCount}잔) 주문이 접수되었습니다!`;
      orderConfirmation.textContent = orderMessage;
      orderConfirmation.style.display = 'block';
      orderConfirmation.classList.remove('hidden');
      orderConfirmation.classList.add('show');
      orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 10) 사용자 편의성: 음료 옵션 & 요청사항은 깔끔하게 초기화하되, 주문자 이름/연락처는 다음 주문을 위해 유지
    cart = [];
    requestsInput.value = '';
    renderCart();
  });

  // ----------------------------------------------------------------------------
  // 12. 다시 작성 (Reset) 이벤트 처리
  // 고객 정보, 장바구니, 음료 옵션 모두 초기화 (단, 접수된 주문 내역 orders는 유지)
  // ----------------------------------------------------------------------------
  orderForm.addEventListener('reset', () => {
    setTimeout(() => {
      cart = [];
      const sizeS = document.getElementById('sizeS');
      if (sizeS) sizeS.checked = true;
      quantityInput.value = 1;

      renderCart();

      orderConfirmation.textContent = '';
      orderConfirmation.style.display = 'none';
      orderConfirmation.classList.remove('show');
    }, 0);
  });

  // 초기 실행: 장바구니 및 (로컬스토리지에서 복원된) 주문 내역 렌더링
  renderCart();
  renderOrders();
});
