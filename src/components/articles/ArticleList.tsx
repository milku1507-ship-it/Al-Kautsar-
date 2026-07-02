
import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Edit } from 'lucide-react';
import { ADMIN_EMAIL } from '../../config/admin';
import { onAuthStateChanged } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function ArticleList() {
  const [articles, setArticles] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(user?.email === ADMIN_EMAIL);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchArticles = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'articles'));
        const articlesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        articlesData.sort((a, b) => (Number(a.articleNumber) || 0) - (Number(b.articleNumber) || 0));
        setArticles(articlesData);
        setFetchError(null);
      } catch (error: any) {
        if (error.code === 'permission-denied') {
          setFetchError("Anda tidak memiliki izin untuk membaca artikel. Pastikan Firebase Rules sudah di deploy.");
        } else {
          setFetchError(error.message || String(error));
        }
        try {
          handleFirestoreError(error, OperationType.LIST, 'articles');
        } catch (e) {
          // ignore thrown error from handleFirestoreError
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchArticles();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'articles', id));
      setArticles(articles.filter(a => a.id !== id));
    } catch(error: any) {
      console.error('Delete error:', error);
      alert(`Gagal menghapus artikel: ${error.message}`);
      handleFirestoreError(error, OperationType.DELETE, 'articles');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Artikel Fiqh</h1>
        {isAdmin && (
          <Link to="/articles/new" className="bg-accent text-white px-4 py-2 rounded flex items-center gap-2">
            <Plus size={16} /> Tambah Artikel
          </Link>
        )}
      </div>
      {fetchError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {fetchError}</span>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="w-8 h-8 border-4 border-[#B91C1C]/30 border-t-[#B91C1C] rounded-full animate-spin"></div>
        </div>
      ) : articles.length === 0 && !fetchError ? (
        <div className="text-center py-12 bg-bg-card border border-border-main rounded-2xl">
          <h3 className="text-text-contrast font-bold text-lg mb-2">Belum ada artikel</h3>
          <p className="text-text-muted">Artikel panduan akan muncul di sini.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map(article => (
            <div key={article.id} className="border border-border-main bg-bg-card p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all">
              <h2 className="text-xl font-bold font-display text-text-contrast tracking-tight mb-2">
                {article.articleNumber ? <span className="text-[#B91C1C]">#{article.articleNumber}</span> : ''} {article.title}
              </h2>
              <p className="text-text-muted text-sm leading-relaxed mb-4">{article.summary}</p>
              <div className="flex items-center gap-3">
                <Link to={`/articles/${article.id}`} className="text-xs font-bold text-[#B91C1C] bg-[#FFF5F5] dark:bg-[#B91C1C]/10 px-4 py-2 rounded-lg hover:bg-[#FEE2E2] active:scale-95 transition-all">
                  Baca Selengkapnya
                </Link>
                {isAdmin && (
                  <div className="flex gap-2 ml-auto">
                    <Link to={`/articles/edit/${article.id}`} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-border-main shadow-xs"><Edit size={16}/></Link>
                    <button 
                      onClick={(e) => { 
                        e.preventDefault();
                        if (window.confirm('Yakin ingin menghapus artikel ini?')) {
                          handleDelete(article.id); 
                        }
                      }} 
                      className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all border border-border-main shadow-xs"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
