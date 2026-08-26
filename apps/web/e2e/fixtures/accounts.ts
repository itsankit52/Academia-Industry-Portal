export const STUDENT = { email: 'arya@demo.edu', password: 'Demo@1234' } as const;
export const COMPANY = { email: 'hr@demotech.demo', password: 'Demo@1234' } as const;
export const ADMIN = { email: 'admin@aip.demo', password: 'Demo@1234' } as const;

export type Credentials = { email: string; password: string };
