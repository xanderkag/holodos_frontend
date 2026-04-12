const fs = require('fs');
const file = '/Users/alexanderliapustin/Desktop/Antigravity2/frontend/src/utils/api.ts';
let data = fs.readFileSync(file, 'utf8');

const apiErrorClass = `
export class ApiError extends Error {
  public status: number;
  public code?: string;
  public data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}
`;

data = data.replace(
  "async function getIdToken(): Promise<string> {",
  apiErrorClass + "\nasync function getIdToken(): Promise<string> {"
);

function replaceFetch(type, matcher) {
  let toReplace = `  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || \`Ошибка сервера \${response.status}\`);
  }`;
  let replacement = `  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(err.message || \`Ошибка сервера \${response.status}\`, response.status, err.code, err);
  }`;
  data = data.replace(toReplace, replacement);
}

replaceFetch();
replaceFetch();
replaceFetch(); // for all 3 api methods

fs.writeFileSync(file, data);
