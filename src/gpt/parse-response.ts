export function parseJSONResponse(response: string): any {
  response = parseTextResponse(response);
  return JSON.parse(response.trim());
}

export function parseTextResponse(response: string): string {
  // If the first line of the response ends with a :, we can usually assume ChatGPT is prefacing
  // the reply with a title and ignore this part.
  if (response.split('\n')[0].endsWith(':')) {
    response = response.split('\n').slice(1).join('\n').trim();
  }

  return response;
}
