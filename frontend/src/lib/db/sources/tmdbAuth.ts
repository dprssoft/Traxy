const BASE_URL = 'https://api.themoviedb.org/3';

export async function createTmdbRequestToken(apiKey: string): Promise<{ token: string; approvalUrl: string }> {
	const res = await fetch(`${BASE_URL}/authentication/token/new?api_key=${apiKey}`);
	if (!res.ok) throw new Error('Failed to create TMDB request token');
	
	const data = await res.json();
	if (!data.success) throw new Error('TMDB API returned unsuccessful token creation');
	
	return {
		token: data.request_token,
		approvalUrl: `https://www.themoviedb.org/authenticate/${data.request_token}`
	};
}

export async function createTmdbSession(apiKey: string, requestToken: string): Promise<string> {
	const res = await fetch(`${BASE_URL}/authentication/session/new?api_key=${apiKey}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ request_token: requestToken })
	});
	
	if (!res.ok) throw new Error('Failed to create TMDB session');
	
	const data = await res.json();
	if (!data.success) throw new Error('TMDB API returned unsuccessful session creation');
	
	return data.session_id;
}
