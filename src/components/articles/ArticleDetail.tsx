
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      if (id) {
        try {
          const docRef = doc(db, 'articles', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setArticle({ id: docSnap.id, ...docSnap.data() });
          } else {
            setError("Artikel tidak ditemukan.");
          }
        } catch (err: any) {
          if (err.code === 'permission-denied') {
            setError("Anda tidak memiliki izin untuk membaca artikel. Pastikan Firebase Rules sudah di deploy.");
          } else {
            setError("Gagal memuat artikel: " + (err.message || String(err)));
          }
        }
      }
    };
    fetchArticle();
  }, [id]);

  if (error) {
    return (
      <div className="p-6">
        <Link to="/articles" className="inline-flex items-center text-accent mb-4 hover:underline">
          <ChevronLeft size={16} className="mr-1" /> Kembali ke Daftar
        </Link>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-4 border-[#B91C1C]/30 border-t-[#B91C1C] rounded-full animate-spin mb-4"></div>
        <p className="text-text-muted animate-pulse">Memuat artikel...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Link to="/articles" className="inline-flex items-center text-accent mb-4 hover:underline">
        <ChevronLeft size={16} className="mr-1" /> Kembali ke Daftar
      </Link>
      <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
      <p className="text-gray-500 my-2">{new Date(article.date).toLocaleDateString()}</p>
      
      <div className="mt-4 max-w-2xl mx-auto text-justify leading-7 text-text-main article-content">
        <ReactMarkdown>{article.content}</ReactMarkdown>
      </div>
    </div>
  );
}
