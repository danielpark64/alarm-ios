import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  ErrorCode,
} from 'react-native-iap';
import type { ProductAndroid, PurchaseError } from 'react-native-iap';

// Play Console에 등록할 인앱 상품 ID
const PRODUCT_ID = 'coffee_tip_01';

export function useCoffeeTip() {
  const [product, setProduct] = useState<ProductAndroid | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') { setLoading(false); return; }

    let purchaseListener: ReturnType<typeof purchaseUpdatedListener>;
    let errorListener: ReturnType<typeof purchaseErrorListener>;

    (async () => {
      try {
        await initConnection();

        purchaseListener = purchaseUpdatedListener(async (purchase) => {
          await finishTransaction({ purchase, isConsumable: true });
          setPurchasing(false);
        });

        errorListener = purchaseErrorListener((err: PurchaseError) => {
          if (err.code !== ErrorCode.UserCancelled) {
            setError('결제 중 오류가 발생했습니다');
          }
          setPurchasing(false);
        });

        const products = await fetchProducts({ skus: [PRODUCT_ID] });
        const found = (products ?? []).find(
          p => p.type === 'in-app' && (p as any).id === PRODUCT_ID
        ) as ProductAndroid | undefined;
        setProduct(found ?? null);
      } catch {
        // 개발/테스트 환경에서는 상품 로드 실패가 정상
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      purchaseListener?.remove();
      errorListener?.remove();
      endConnection();
    };
  }, []);

  const purchase = async () => {
    if (!product || purchasing) return;
    setError(null);
    setPurchasing(true);
    try {
      await requestPurchase({
        type: 'in-app',
        request: { android: { skus: [PRODUCT_ID] } },
      });
    } catch {
      setPurchasing(false);
    }
  };

  return { product, loading, purchasing, purchase, error };
}
