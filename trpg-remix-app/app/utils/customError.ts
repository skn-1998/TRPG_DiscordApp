export function CustomError(error: unknown | null | undefined) :string {
  if(error instanceof Error) {
    return error.message
  } else {
    return "Unknown Error"
  }
}
