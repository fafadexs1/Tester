
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getProperty } from 'dot-prop';

interface ApiTestRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  headers?: { id: string; key: string; value: string }[];
  queryParams?: { id: string; key: string; value: string }[];
  auth?: {
    type?: 'none' | 'bearer' | 'basic';
    bearerToken?: string;
    basicUser?: string;
    basicPassword?: string;
  };
  body?: {
    type?: 'none' | 'json' | 'form-data' | 'raw';
    json?: string;
    formData?: { id: string; key: string; value: string }[];
    raw?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const reqBody: ApiTestRequest = await request.json();
    const { url, method = 'GET', headers: customHeaders, queryParams, auth, body: requestBodyDetails } = reqBody;

    if (!url) {
      return NextResponse.json({ error: 'URL da API é obrigatória.' }, { status: 400 });
    }

    const finalUrl = new URL(url);
    if (queryParams) {
      queryParams.forEach(param => {
        if (param.key) finalUrl.searchParams.append(param.key, param.value);
      });
    }

    const headers = new Headers();
    if (customHeaders) {
      customHeaders.forEach(header => {
        if (header.key) headers.append(header.key, header.value);
      });
    }

    if (auth?.type === 'bearer' && auth.bearerToken) {
      headers.append('Authorization', `Bearer ${auth.bearerToken}`);
    } else if (auth?.type === 'basic' && auth.basicUser && auth.basicPassword) {
      headers.append('Authorization', `Basic ${btoa(`${auth.basicUser}:${auth.basicPassword}`)}`);
    }

    let body: BodyInit | null = null;
    if (method !== 'GET' && method !== 'HEAD') {
      if (requestBodyDetails?.type === 'json' && requestBodyDetails.json) {
        body = requestBodyDetails.json;
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
      } else if (requestBodyDetails?.type === 'raw' && requestBodyDetails.raw) {
        body = requestBodyDetails.raw;
      } else if (requestBodyDetails?.type === 'form-data' && requestBodyDetails.formData) {
        const formData = new FormData();
        requestBodyDetails.formData.forEach(item => {
          if (item.key) formData.append(item.key, item.value);
        });
        body = formData;
      }
    }

    const apiResponse = await fetch(finalUrl.toString(), {
      method,
      headers,
      body,
    });

    const contentType = apiResponse.headers.get('content-type');
    let responseData;
    if (contentType && contentType.includes('application/json')) {
      responseData = await apiResponse.json();
    } else {
      responseData = await apiResponse.text();
    }

    if (!apiResponse.ok) {
      return NextResponse.json({
        error: `A chamada à API falhou com status ${apiResponse.status}.`,
        details: responseData
      }, { status: 400 });
    }

    return NextResponse.json({ data: responseData, status: apiResponse.status }, { status: 200 });

  } catch (error: any) {
    console.error('[API Test Proxy Error]', error);
    return NextResponse.json({ error: `Erro interno no servidor proxy: ${error.message}` }, { status: 500 });
  }
}
