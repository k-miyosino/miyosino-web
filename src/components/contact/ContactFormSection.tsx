'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { ContactType, CONTACT_TYPE_LABELS } from '@/types/contact';

interface FormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  type: ContactType;
  privacyConsent: boolean;
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
  type: ContactType.GENERAL,
  privacyConsent: false,
};

export default function ContactFormSection() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>('');
  const [isLoadingSiteKey, setIsLoadingSiteKey] = useState(true);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // サーバーサイドAPIからサイトキーを取得
  useEffect(() => {
    const fetchSiteKey = async () => {
      try {
        // NEXT_PUBLIC_CONTACT_API_URL が設定されていれば Cloudflare Worker を使用
        // 未設定の場合はローカルの API ルートを使用（フォールバック）
        const contactApiUrl = process.env.NEXT_PUBLIC_CONTACT_API_URL;

        let apiUrl: string;
        if (contactApiUrl) {
          // Cloudflare Worker を使用（開発環境・本番環境共通）
          const baseUrl = contactApiUrl.replace(/\/$/, '');
          // /api/contactが含まれている場合は置き換え、含まれていない場合は末尾に追加
          if (baseUrl.includes('/api/contact')) {
            apiUrl = baseUrl.replace('/api/contact', '/api/turnstile-site-key');
          } else {
            // /api/contactが含まれていない場合は、末尾に/api/turnstile-site-keyを追加
            apiUrl = `${baseUrl}/api/turnstile-site-key`;
          }
        } else {
          // フォールバック: ローカルの API ルートを使用（開発環境のみ）
          const isDevelopment =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1');

          if (isDevelopment) {
            apiUrl = '/api/turnstile-site-key';
          } else {
            console.error(
              '[ContactForm] NEXT_PUBLIC_CONTACT_API_URLが設定されていません'
            );
            apiUrl = '/api/turnstile-site-key'; // フォールバック（動作しない）
          }
        }

        const response = await fetch(apiUrl);

        if (response.ok) {
          const data = await response.json();
          const siteKey = data.siteKey || '';
          if (!siteKey) {
            console.error(
              '[ContactForm] サイトキーが空です。レスポンスデータ:',
              JSON.stringify(data)
            );
          } else {
            setTurnstileSiteKey(siteKey);
          }
        } else {
          const errorText = await response.text();
          console.error(
            '[ContactForm] サイトキーの取得に失敗しました:',
            response.status,
            response.statusText,
            'エラー内容:',
            errorText
          );
        }
      } catch (error) {
        console.error('[ContactForm] サイトキー取得エラー:', error);
      } finally {
        setIsLoadingSiteKey(false);
      }
    };

    fetchSiteKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Turnstileトークンのチェック
    if (!turnstileToken) {
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // フォーム送信のロジック（APIエンドポイントに送信）
      // NEXT_PUBLIC_CONTACT_API_URL が設定されていれば Cloudflare Worker を使用
      // 未設定の場合はローカルの API ルートを使用（フォールバック）
      const contactApiUrl = process.env.NEXT_PUBLIC_CONTACT_API_URL;

      let apiUrl: string;
      if (contactApiUrl) {
        // Cloudflare Worker を使用（開発環境・本番環境共通）
        const baseUrl = contactApiUrl.replace(/\/$/, '');
        // /api/contactが含まれている場合はそのまま、含まれていない場合は末尾に追加
        if (baseUrl.includes('/api/contact')) {
          apiUrl = baseUrl;
        } else {
          // /api/contactが含まれていない場合は、末尾に/api/contactを追加
          apiUrl = `${baseUrl}/api/contact`;
        }
      } else {
        // フォールバック: ローカルの API ルートを使用（開発環境のみ）
        const isDevelopment =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1');

        if (isDevelopment) {
          apiUrl = '/api/contact';
        } else {
          console.error(
            'APIエンドポイントが設定されていません。静的エクスポートの場合は、NEXT_PUBLIC_CONTACT_API_URLを設定してください。'
          );
          setSubmitStatus('error');
          setIsSubmitting(false);
          return;
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          turnstileToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('APIエラー:', response.status, errorData);
        setSubmitStatus('error');
        // エラー時もTurnstileをリセット
        turnstileRef.current?.reset();
        setTurnstileToken(null);
        setIsSubmitting(false);
        return;
      }

      await response.json();
      setSubmitStatus('success');
      setFormData(initialFormData);
      setTurnstileToken(null);
      // Turnstileをリセット
      turnstileRef.current?.reset();
    } catch (error) {
      console.error('Form submission error:', error);
      setSubmitStatus('error');
      // エラー時もTurnstileをリセット
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.name &&
    formData.email &&
    formData.subject &&
    formData.message &&
    formData.privacyConsent &&
    turnstileToken;

  return (
    <div
      id="form"
      className="bg-white rounded-2xl shadow-lg border-2 border-blue-500 p-8 lg:p-10 relative"
    >
      {/* セクション識別用のバッジ */}
      <div className="absolute top-4 right-4 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
        フォーム
      </div>
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          お問い合わせフォーム
        </h2>
        <div className="w-16 h-1 bg-blue-500 rounded-full mx-auto mt-2 mb-3"></div>
        <p className="text-gray-600">
          詳細なご質問やご相談は、こちらのフォームからお送りください
        </p>
      </div>

      {submitStatus === 'success' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <svg
              className="w-5 h-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="text-green-800">
              お問い合わせを送信しました。ありがとうございます。
              担当者よりご連絡いたします。
            </p>
          </div>
        </div>
      )}

      {submitStatus === 'error' && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-red-800 font-semibold mb-1">
                送信に失敗しました
              </p>
              <p className="text-sm text-red-700">
                しばらく時間をおいて再度お試しください。
                <br />
                解決しない場合は、お電話でのお問い合わせをお願いいたします。
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* お問い合わせの種類 */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            お問い合わせの種類 <span className="text-red-500">*</span>
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            required
          >
            {Object.entries(CONTACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* お名前 */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder:text-gray-400"
            placeholder="三芳野 太郎"
            required
          />
        </div>

        {/* メールアドレス */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            メールアドレス <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder:text-gray-400"
            placeholder="example@email.com"
            required
          />
        </div>

        {/* 電話番号 */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            電話番号
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder:text-gray-400"
            placeholder="090-1234-5678"
          />
        </div>

        {/* 件名 */}
        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            件名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder:text-gray-400"
            placeholder="お問い合わせの件名をご入力ください"
            required
          />
        </div>

        {/* お問い合わせ内容 */}
        <div>
          <label
            htmlFor="message"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            お問い合わせ内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            rows={6}
            className="w-full px-3 py-2 bg-white text-gray-900 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm placeholder:text-gray-400 resize-y"
            placeholder="お問い合わせの詳細をご記入ください"
            required
          />
        </div>

        {/* プライバシーポリシー同意 */}
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="privacyConsent"
            name="privacyConsent"
            checked={formData.privacyConsent}
            onChange={handleInputChange}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            required
          />
          <label
            htmlFor="privacyConsent"
            className="text-sm font-medium text-gray-900"
          >
            <span className="text-red-500">*</span>{' '}
            <Link
              href="/privacy"
              className="text-blue-600 hover:text-blue-800 underline font-semibold"
            >
              プライバシーポリシー
            </Link>
            に同意します
          </label>
        </div>

        {/* Cloudflare Turnstile */}
        {isLoadingSiteKey && (
          <div className="flex justify-center text-gray-500 text-sm">
            読み込み中...
          </div>
        )}
        {!isLoadingSiteKey && !turnstileSiteKey && (
          <div className="flex justify-center text-red-500 text-sm mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <div>
              <p className="font-semibold mb-1">
                警告: Turnstileサイトキーが取得できませんでした
              </p>
              <p className="text-xs text-red-600">
                ブラウザのコンソール（F12）でエラーログを確認してください。
                <br />
                Cloudflare Worker 側で TURNSTILE_SITE_KEY
                が設定されているか確認してください。
              </p>
            </div>
          </div>
        )}
        {!isLoadingSiteKey && turnstileSiteKey && (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={turnstileSiteKey}
              onSuccess={(token) => {
                setTurnstileToken(token);
              }}
              onError={(error) => {
                console.error('[ContactForm] Turnstileエラー:', error);
                setTurnstileToken(null);
              }}
              onExpire={() => {
                setTurnstileToken(null);
              }}
            />
          </div>
        )}

        {/* 送信ボタン */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-colors duration-200 ${
              isFormValid && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <svg
                  className="animate-spin h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>送信中...</span>
              </div>
            ) : (
              'お問い合わせを送信'
            )}
          </button>
        </div>
      </form>

      {/* 注意事項 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          お問い合わせについて
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 緊急の場合はお電話でのお問い合わせをお勧めします</li>
          <li>
            • 個人情報は適切に管理し、お問い合わせ対応以外には使用しません
          </li>
        </ul>
      </div>
    </div>
  );
}
