type Rule = (value: string, confirmValue?: string) => string | null;

export const required: Rule = (v) => (v.trim() ? null : "This field is required");

export const email: Rule = (v) =>
	/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email format';

export const minLength =
	(min: number, message?: string): Rule =>
	(v) =>
		v.length >= min ? null : (message ?? `Minimum length: ${min} characters`);

export const passwordMatch: Rule = (v, confirm) =>
	v === confirm ? null : 'Passwords do not match';

export function validate(value: string, rules: Rule[], confirmValue?: string): string | null {
	for (const rule of rules) {
		const error = rule(value, confirmValue);
		if (error) return error;
	}
	return null;
}

// Backwards-compatible aliases
export const RequiredStrategy = { validate: required };
export const EmailStrategy = { validate: email };
export const MinLengthStrategy = (min: number, msg?: string) => ({ validate: minLength(min, msg) });
export const PasswordMatchStrategy = { validate: passwordMatch };
export class Validator {
	static validate(value: string, strategies: { validate: Rule }[], confirmValue?: string): string | null {
		for (const s of strategies) {
			const error = s.validate(value, confirmValue);
			if (error) return error;
		}
		return null;
	}
}
