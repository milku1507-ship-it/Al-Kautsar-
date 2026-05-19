
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useParams, useNavigate } from 'react-router-dom';

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Haid');
  const [articleNumber, setArticleNumber] = useState(1);

  useEffect(() => {
    if (id) {
      const fetchArticle = async () => {
        const docRef = doc(db, 'articles', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title);
          setSummary(data.summary);
          setContent(data.content);
          setCategory(data.category);
          setArticleNumber(data.articleNumber || 1);
        }
      };
      fetchArticle();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const articleData = { title, summary, content, category, articleNumber: Number(articleNumber), date: new Date().toISOString(), authorId: auth.currentUser?.uid };
    try {
      if (id) {
        await setDoc(doc(db, 'articles', id), articleData);
      } else {
        await addDoc(collection(db, 'articles'), articleData);
      }
      navigate('/articles');
    } catch (error) {
      console.error("Error saving article:", error);
      // In a real app we'd use the proper handleFirestoreError, 
      // but let's at least show something is happening.
      alert("Gagal menyimpan artikel. Periksa izin atau isi form.");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">{id ? 'Edit Artikel' : 'Tambah Artikel'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul" className="w-full border p-3 rounded" required />
        <input type="text" value={summary} onChange={e => setSummary(e.target.value)} placeholder="Ringkasan" className="w-full border p-3 rounded" />
        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border p-3 rounded text-slate-800">
          <option>Haid</option>
          <option>Nifas</option>
          <option>Istihadloh</option>
          <option>Umum</option>
        </select>
        <input type="number" value={articleNumber} onChange={e => setArticleNumber(Number(e.target.value))} placeholder="Nomor Artikel" className="w-full border p-3 rounded" required />
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Konten" className="w-full border p-3 rounded h-96" required />
        <button type="submit" className="w-full md:w-auto bg-accent text-white px-6 py-3 rounded font-semibold">Simpan</button>
      </form>
    </div>
  );
}
