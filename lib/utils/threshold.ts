export interface ThresholdData {
  id?: string;
  threshold: number;
}

export async function updateProductThreshold(
  productId: string, 
  threshold: number
): Promise<ThresholdData> {
  const response = await fetch(`/api/products/${productId}/threshold`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ threshold }),
  });

  if (!response.ok) {
    throw new Error('Failed to update threshold');
  }

  const data = await response.json();
  return data;
}

export async function getProductThreshold(
  productId: string
): Promise<ThresholdData> {
  const response = await fetch(`/api/products/${productId}/threshold`);

  if (!response.ok) {
    throw new Error('Failed to fetch threshold');
  }

  const data = await response.json();
  return data;
}
