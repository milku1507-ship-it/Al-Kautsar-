
import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function ArticleDetail() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      if (id) {
        const docRef = doc(db, 'articles', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setArticle({ id: docSnap.id, ...docSnap.data() });
        }
      }
    };
    fetchArticle();
  }, [id]);

  if (!article) return <div>Loading...</div>;

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
