
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Logged in user email:', user?.email);
      console.log('ADMIN_EMAIL:', ADMIN_EMAIL);
      setIsAdmin(user?.email === ADMIN_EMAIL);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'articles'));
        const articlesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        articlesData.sort((a, b) => (Number(a.articleNumber) || 0) - (Number(b.articleNumber) || 0));
        setArticles(articlesData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'articles');
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
      <div className="grid gap-4">
        {articles.map(article => (
          <div key={article.id} className="border p-4 rounded shadow">
            <h2 className="text-xl font-semibold">{article.articleNumber ? `#${article.articleNumber} - ` : ''}{article.title}</h2>
            <p className="text-gray-600">{article.summary}</p>
            <div className="mt-2 flex gap-2">
              <Link to={`/articles/${article.id}`} className="text-blue-500">Baca Selengkapnya</Link>
              {isAdmin && (
                <>
                  <Link to={`/articles/edit/${article.id}`} className="text-green-500"><Edit size={16}/></Link>
                  <button 
                    onClick={(e) => { 
                      e.preventDefault();
                      handleDelete(article.id); 
                    }} 
                    className="text-red-500 p-2 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16}/>
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
