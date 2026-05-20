export const responseFormatter = {
  success: (data: any, message: string = 'Success', statusCode: number = 200) => ({
    status: 'success',
    message,
    data,
    statusCode,
  }),

  error: (message: string = 'Error', statusCode: number = 500, errors: any = null) => ({
    status: 'error',
    message,
    statusCode,
    errors,
  }),
};
