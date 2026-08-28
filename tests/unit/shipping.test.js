const {
  SHIPPING_METHODS,
  calculateShippingFee
} = require('../../src/utils/shipping');

describe('Shipping 運費計算', () => {
  it('宅配基本運費為 120 元', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      subtotal: 1000
    })).toEqual({ baseFee: 120, surcharge: 0, shippingFee: 120 });
  });

  it('超商取貨費用為 60 元', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.CVS,
      subtotal: 1000
    })).toEqual({ baseFee: 60, surcharge: 0, shippingFee: 60 });
  });

  it('商品小計 1,499 元仍收取宅配基本運費', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      subtotal: 1499
    }).shippingFee).toBe(120);
  });

  it('商品小計 1,500 元免基本運費', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      subtotal: 1500
    })).toEqual({ baseFee: 0, surcharge: 0, shippingFee: 0 });
  });

  it('偏遠地區會加收 200 元', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      subtotal: 1000,
      isRemoteArea: true
    })).toEqual({ baseFee: 120, surcharge: 200, shippingFee: 320 });
  });

  it('當日急件會加收 250 元', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      subtotal: 1000,
      isExpress: true
    })).toEqual({ baseFee: 120, surcharge: 250, shippingFee: 370 });
  });

  it('多項附加費可同時成立', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      subtotal: 1000,
      isRemoteArea: true,
      isExpress: true
    })).toEqual({ baseFee: 120, surcharge: 450, shippingFee: 570 });
  });

  it('滿額免運時附加費仍須收取', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.HOME_DELIVERY,
      subtotal: 1500,
      isRemoteArea: true,
      isExpress: true
    })).toEqual({ baseFee: 0, surcharge: 450, shippingFee: 450 });
  });

  it('超商取貨達滿額門檻同樣免基本運費', () => {
    expect(calculateShippingFee({
      shippingMethod: SHIPPING_METHODS.CVS,
      subtotal: 1500
    }).shippingFee).toBe(0);
  });

  it('拒絕不合法的配送方式與小計', () => {
    expect(() => calculateShippingFee({ subtotal: 1000 }))
      .toThrow('shippingMethod 必須為 home_delivery 或 cvs 其中之一');
    expect(() => calculateShippingFee({ shippingMethod: 'pickup', subtotal: 1000 })).toThrow();
    expect(() => calculateShippingFee({ shippingMethod: SHIPPING_METHODS.CVS, subtotal: 1000.5 })).toThrow();
  });
});
