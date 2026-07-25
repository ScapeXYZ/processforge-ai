const NEXT_CONTINUATION_HEADER = "x-middleware-next";

export function isNextContinuationResponse(response: Response): boolean {
  return response.headers.get(NEXT_CONTINUATION_HEADER) === "1";
}

export function ensureRouteHandlerResponse(
  response: Response,
  requestId: string | null,
): Response {
  if (!isNextContinuationResponse(response)) return response;

  return Response.json(
    {
      error: {
        code: "INVALID_ROUTE_CONTINUATION",
        message: "The request could not be completed.",
        request_id: requestId,
      },
    },
    {
      status: 500,
      headers: { "cache-control": "no-store" },
    },
  );
}
