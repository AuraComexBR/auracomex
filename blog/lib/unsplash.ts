export interface CoverImage {
  url: string;
  alt: string;
  photographer_name: string;
  photographer_url: string;
  unsplash_url: string;
}

/**
 * Busca uma foto relevante no Unsplash pra usar como capa do post.
 * Sem UNSPLASH_ACCESS_KEY configurada, ou se a busca não achar nada, retorna null
 * — o post é salvo sem imagem em vez de quebrar a geração.
 */
export async function fetchCoverImage(query: string): Promise<CoverImage | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '1');
    url.searchParams.set('orientation', 'landscape');
    url.searchParams.set('content_filter', 'high');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });

    if (!res.ok) {
      console.error('Unsplash: falha na busca', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;

    return {
      url: photo.urls?.regular,
      alt: photo.alt_description || query,
      photographer_name: photo.user?.name ?? 'Unsplash',
      photographer_url: `${photo.user?.links?.html}?utm_source=aura_comex_blog&utm_medium=referral`,
      unsplash_url: 'https://unsplash.com/?utm_source=aura_comex_blog&utm_medium=referral',
    };
  } catch (err) {
    console.error('Unsplash: erro ao buscar imagem', err);
    return null;
  }
}
