export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://b1828a3cd228.ngrok-free.app';

export const API_ROUTES = {
  menu: API_BASE_URL + '/menu-items',
  orders: API_BASE_URL + '/orders',
  vacationRequests: API_BASE_URL + '/vacation-requests',
};
