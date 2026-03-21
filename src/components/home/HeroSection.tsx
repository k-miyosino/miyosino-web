'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type {
  Photo,
  MicroCMSCommonTopImage,
  MicroCMSTopImageListResponse,
} from '@/types/media';
import { CONTENT_CATEGORIES } from '@/types/categories';

export default function HeroSection() {
  const [heroPhoto, setHeroPhoto] = useState<Photo | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cloudflare Workers経由でMicroCMSから写真データを取得
  // APIキーはサーバーサイド（Cloudflare Workers）で管理され、クライアントに露出しません
  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setLoading(true);

        // Cloudflare Workersのエンドポイントを取得
        const apiEndpoint = process.env.NEXT_PUBLIC_PHOTOS_API_ENDPOINT;

        if (!apiEndpoint) {
          console.error(
            '[HeroSection] API endpoint is not set. Please configure NEXT_PUBLIC_PHOTOS_API_ENDPOINT environment variable.'
          );
          setLoading(false);
          return;
        }

        // Cloudflare Workers経由で取得
        const url = new URL(apiEndpoint);
        url.searchParams.append('category', CONTENT_CATEGORIES.TOP_IMAGE); // カテゴリIDでフィルタ
        url.searchParams.append('orders', 'order'); // 表示順でソート
        url.searchParams.append('getAll', 'true'); // 全件取得

        const response = await fetch(url.toString(), {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch photos: ${response.status} ${response.statusText}`
          );
        }

        const data: MicroCMSTopImageListResponse = await response.json();

        // クライアント側でカテゴリフィルタリング（category.idがCONTENT_CATEGORIES.TOP_IMAGEのもののみ）
        const filteredContents = data.contents.filter(
          (topImage: MicroCMSCommonTopImage) => {
            if (!Array.isArray(topImage.category)) {
              return false;
            }
            return topImage.category.some(
              (cat) => cat && cat.id === CONTENT_CATEGORIES.TOP_IMAGE
            );
          }
        );

        console.log(
          `[HeroSection] フィルタリング後のデータ数: ${filteredContents.length}`
        );

        // APIは photo で返す場合と image で返す場合があるので両方対応
        const fetchedPhotos: Photo[] = data.contents
          .filter((content: MicroCMSCommonTopImage) => {
            const img = content.photo ?? content.image;
            return img !== undefined;
          })
          .map((content: MicroCMSCommonTopImage) => {
            const fallback = {
              url: '/fallback.jpg',
              width: 0,
              height: 0,
            };
            const img = content.photo ?? content.image ?? fallback;
            return {
              id: content.id,
              createdAt: new Date(content.createdAt),
              updatedAt: new Date(content.updatedAt),
              title: content.title,
              description: content.description,
              image: img,
              order: content.order ?? 0,
            };
          });

        // orderが最小の写真のみを設定
        if (fetchedPhotos.length > 0) {
          const minOrderPhoto = fetchedPhotos.reduce((prev, current) =>
            prev.order <= current.order ? prev : current
          );
          setHeroPhoto(minOrderPhoto);
        }
      } catch (error) {
        console.error('[HeroSection] 写真取得エラー:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, []);

  // ローディング中または写真が空の場合、または画像読み込みエラーの場合のフォールバック
  if (loading || !heroPhoto || imageError) {
    return (
      <section className="relative bg-gradient-to-br from-green-50 to-green-100 overflow-hidden h-[70vh] min-h-[500px]">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-20 h-20 bg-green-200 rounded-full opacity-30"></div>
          <div className="absolute top-32 right-20 w-16 h-16 bg-green-300 rounded-full opacity-40"></div>
          <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-green-200 rounded-full opacity-25"></div>
          <div className="absolute bottom-32 right-1/3 w-18 h-18 bg-green-300 rounded-full opacity-35"></div>
        </div>
        <HeroContent />
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden flex flex-col">
      {/* 背景写真 */}
      <div className="relative h-[70vh] min-h-[500px]">
        <div className="absolute inset-0">
          <Image
            src={heroPhoto.image?.url || '/fallback.jpg'}
            alt={heroPhoto.title || 'ヒーロー画像'}
            fill
            priority
            className="object-cover"
            sizes="100vw"
            style={{
              objectFit: 'cover',
              objectPosition: 'center',
            }}
            unoptimized
            onLoad={() => {
              setImageLoaded(true);
              setImageError(false);
            }}
            onError={() => {
              console.error(
                '[HeroSection] 画像読み込みエラー:',
                heroPhoto.image.url
              );
              setImageError(true);
              setImageLoaded(false);
            }}
          />
          {/* 画像読み込み中のインジケーター（オプション） */}
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          )}
          {/* オーバーレイ（テキストの可読性向上） */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/40"></div>
        </div>

        <HeroContent />
      </div>
    </section>
  );
}

function HeroContent() {
  return (
    <div className="relative h-full w-full flex items-start pt-12 md:pt-16 lg:pt-24">
      <div className="w-full px-4 sm:px-6 lg:px-12">
        <div className="text-left text-white z-10 max-w-5xl">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6 tracking-widest drop-shadow-lg opacity-0 animate-fade-in-up whitespace-nowrap">
            かわつる三芳野団地へようこそ。
          </h1>
          <p className="text-sm md:text-base lg:text-lg mb-10 font-light tracking-wider drop-shadow-md opacity-0 animate-fade-in-up delay-300">
            団地の活動と暮らしをご紹介します。
          </p>
          <div className="opacity-0 animate-fade-in-up delay-500">
            <a
              href="/features"
              className="inline-block bg-white/90 text-green-800 hover:bg-white px-8 py-3 rounded-full font-medium transition-all duration-300 hover:shadow-lg hover:scale-105 backdrop-blur-sm"
            >
              団地の特徴を見る
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
