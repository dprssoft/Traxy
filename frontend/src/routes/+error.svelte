<script lang="ts">
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import errorImage from '$lib/assets/error-image.png';
</script>

<div class="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0b12]">
	<div class="max-w-md w-full flex flex-col items-center p-8 bg-[#121422]/90 backdrop-blur-xl rounded-3xl border border-white/[0.08] shadow-2xl">
		
		<img 
			src={errorImage} 
			alt="Error Illustration" 
			class="w-full max-w-[180px] h-auto object-contain mb-6 opacity-90" 
		/>

		<div class="text-indigo-400 font-black text-5xl mb-3 tracking-tight">
			{$page.status}
		</div>

		<h1 class="text-xl font-bold mb-2 text-white text-center">
			Oops! An error occurred
		</h1>

		<p class="text-slate-400 mb-8 text-center text-xs">
			{$page.error?.message || 'Something went wrong.'}
		</p>

		<a 
			href={resolve('/')} 
			class="inline-flex items-center justify-center px-6 py-2.5 text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all w-full sm:w-auto"
		>
			Return to Home Page
		</a>
	</div>
</div>

