import { LoaderFunctionArgs, redirect } from '@remix-run/node';
import axios from 'axios';
import https from 'https';
import { CustomError } from './customError';

export type TRPGUser = {
  message?: string;
  DiscordUserId: string;
  userName: string;
  token?: string;
  characterId?: string[];
};

// 共通のaxiosインスタンスを作成
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const createAxiosInstance = (baseURL: string) => {
  return axios.create({
    baseURL,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    withCredentials: true,
  });
};

const corsServerDomain = process.env.SERVER_DOMAIN || 'http://localhost:3000';
const axiosInstance = createAxiosInstance(corsServerDomain);

export const loginOrRegisterUser = async (code: string): Promise<TRPGUser> => {
  try {
    const response = await axiosInstance.post('/auth/login', { code });
    return response.data;
  } catch (err: unknown) {
    throw new Error(CustomError(err));
  }
};

export const validateJWT = async ({ request }: LoaderFunctionArgs): Promise<object | null> => {
  const cookie = request.headers.get('Cookie') || '';
  const jwtCookie = cookie.split(';').find((cookie) => cookie.trim().startsWith('jwt='));

  if (!jwtCookie) {
    return redirect('/login');
  }

  const jwt = jwtCookie.split('=')[1];
  const verifyUrl = '/trpg-user'; // JWT検証用のAPIエンドポイント

  try {
    const response = await axiosInstance.get(verifyUrl, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.data) {
      return redirect('/login');
    }

    return response.data;
  } catch (err: unknown) {
    console.error(CustomError(err));
    return redirect('/login');
  }
};
