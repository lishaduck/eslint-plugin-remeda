export interface RemedaMethodVisitors {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ESLintContext {
  settings?: {
    remeda?: {
      version?: number;
    };
  };
  ecmaFeatures?: Record<string, boolean>;
  parserOptions?: {
    ecmaVersion?: number | string;
  };
}
