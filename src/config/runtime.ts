/** True when running on Vercel, Netlify Functions, or AWS Lambda (not local `npm run dev`). */
export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}
