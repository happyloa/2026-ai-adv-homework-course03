const { createApp, ref, computed, onMounted, watch } = Vue;

const HOME_DELIVERY_BASE_FEE = 120;
const CVS_FEE = 60;
const FREE_SHIPPING_THRESHOLD = 1500;
const REMOTE_AREA_SURCHARGE = 200;
const EXPRESS_SURCHARGE = 250;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const loading = ref(true);
    const submitting = ref(false);
    const cartItems = ref([]);
    const form = ref({
      recipientName: '',
      recipientEmail: '',
      recipientAddress: '',
      shippingMethod: 'home_delivery',
      isRemoteArea: false,
      isExpress: false
    });
    const errors = ref({});

    const cartTotal = computed(function () {
      return cartItems.value.reduce(function (sum, item) {
        return sum + item.product.price * item.quantity;
      }, 0);
    });

    const selectedBaseFee = computed(function () {
      return form.value.shippingMethod === 'cvs' ? CVS_FEE : HOME_DELIVERY_BASE_FEE;
    });

    const shippingFee = computed(function () {
      const baseFee = cartTotal.value >= FREE_SHIPPING_THRESHOLD ? 0 : selectedBaseFee.value;
      const surcharge = (form.value.isRemoteArea ? REMOTE_AREA_SURCHARGE : 0)
        + (form.value.isExpress ? EXPRESS_SURCHARGE : 0);
      return { baseFee, surcharge, shippingFee: baseFee + surcharge };
    });

    const orderTotal = computed(function () {
      return cartTotal.value + shippingFee.value.shippingFee;
    });

    watch(() => form.value.shippingMethod, function (shippingMethod) {
      if (shippingMethod === 'cvs') {
        form.value.isRemoteArea = false;
        form.value.isExpress = false;
      }
    });

    function validate() {
      errors.value = {};
      if (!form.value.recipientName.trim()) errors.value.recipientName = '請輸入收件人姓名';
      if (!form.value.recipientEmail.trim()) {
        errors.value.recipientEmail = '請輸入 Email';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.recipientEmail)) {
        errors.value.recipientEmail = 'Email 格式不正確';
      }
      if (!form.value.recipientAddress.trim()) errors.value.recipientAddress = '請輸入收件地址';
      if (!['home_delivery', 'cvs'].includes(form.value.shippingMethod)) {
        errors.value.shippingMethod = '請選擇配送方式';
      }
      return Object.keys(errors.value).length === 0;
    }

    async function submitOrder() {
      if (!validate() || submitting.value) return;
      submitting.value = true;
      try {
        const res = await apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify(form.value)
        });
        Notification.show('訂單已建立', 'success');
        window.location.href = '/orders/' + res.data.id;
      } catch (err) {
        Notification.show(err?.data?.message || '訂單建立失敗', 'error');
      } finally {
        submitting.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/cart');
        cartItems.value = res.data.items;
        if (cartItems.value.length === 0) {
          window.location.href = '/cart';
          return;
        }
      } catch (e) {
        window.location.href = '/cart';
        return;
      }
      loading.value = false;
    });

    return {
      loading,
      submitting,
      cartItems,
      form,
      errors,
      cartTotal,
      selectedBaseFee,
      shippingFee,
      orderTotal,
      submitOrder
    };
  }
}).mount('#app');

document.documentElement.dataset.pageReady = 'checkout';
