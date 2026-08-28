const SHIPPING_METHODS = Object.freeze({
  HOME_DELIVERY: 'home_delivery',
  CVS: 'cvs'
});

const HOME_DELIVERY_BASE_FEE = 120;
const CVS_FEE = 60;
const FREE_SHIPPING_THRESHOLD = 1500;
const REMOTE_AREA_SURCHARGE = 200;
const EXPRESS_SURCHARGE = 250;

/**
 * Calculate a delivery quote from an order subtotal and delivery options.
 * This module is deliberately free of HTTP and database dependencies so that
 * the pricing rules can be tested independently from the order flow.
 *
 * @param {object} options
 * @param {'home_delivery'|'cvs'} options.shippingMethod
 * @param {number} options.subtotal
 * @param {boolean} [options.isRemoteArea]
 * @param {boolean} [options.isExpress]
 * @returns {{baseFee: number, surcharge: number, shippingFee: number}}
 */
function calculateShippingFee({
  shippingMethod,
  subtotal,
  isRemoteArea = false,
  isExpress = false
} = {}) {
  if (!Object.values(SHIPPING_METHODS).includes(shippingMethod)) {
    throw new Error('shippingMethod 必須為 home_delivery 或 cvs 其中之一');
  }

  if (!Number.isInteger(subtotal) || subtotal < 0) {
    throw new Error('subtotal 必須為 0 以上的整數');
  }

  const baseFee = subtotal >= FREE_SHIPPING_THRESHOLD
    ? 0
    : shippingMethod === SHIPPING_METHODS.HOME_DELIVERY
      ? HOME_DELIVERY_BASE_FEE
      : CVS_FEE;

  const surcharge = (isRemoteArea ? REMOTE_AREA_SURCHARGE : 0)
    + (isExpress ? EXPRESS_SURCHARGE : 0);

  return {
    baseFee,
    surcharge,
    shippingFee: baseFee + surcharge
  };
}

module.exports = {
  SHIPPING_METHODS,
  HOME_DELIVERY_BASE_FEE,
  CVS_FEE,
  FREE_SHIPPING_THRESHOLD,
  REMOTE_AREA_SURCHARGE,
  EXPRESS_SURCHARGE,
  calculateShippingFee
};
