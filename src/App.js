import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, History, 
  Store, Settings, LogOut, Download, Users, Key, User, Clock, 
  Menu, X, Search, Shield
} from 'lucide-react';

// --- IMPORTATION FIREBASE ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, onSnapshot, doc, addDoc, 
  updateDoc, deleteDoc, setDoc, query, orderBy 
} from "firebase/firestore";

// --- VOS CLÉS DE CONNEXION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDRlBQ4M0kinBPIskkOy_x_89v2Fig7iIU",
  authDomain: "caisse-acbt-ba730.firebaseapp.com",
  projectId: "caisse-acbt-ba730",
  storageBucket: "caisse-acbt-ba730.firebasestorage.app",
  messagingSenderId: "920558603636",
  appId: "1:920558603636:web:df4e61475da8b69c73f021"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  // --- ÉTATS (STATE) ---
  const [isLocked, setIsLocked] = useState(true);
  const [identifiantInput, setIdentifiantInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Données synchronisées avec Firebase
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [categories, setCategories] = useState(['Buvette', 'Librairie', 'Bazar']);
  
  const [isLoading, setIsLoading] = useState(true);

  // États de l'interface
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Toutes');
  const [currentView, setCurrentView] = useState('caisse');
  const [adminTab, setAdminTab] = useState('produits');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState(null);
  const [loginError, setLoginError] = useState(false);
  const [trackStock, setTrackStock] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 2FA
  const [requires2FA, setRequires2FA] = useState(false);
  const [code2FA, setCode2FA] = useState('');
  const [expected2FACode, setExpected2FACode] = useState('');
  const [pendingUser, setPendingUser] = useState(null);

  // Formulaires
  const [newProduct, setNewProduct] = useState({ name: '', price: '', category: 'Buvette', image: '', stock: '' });
  const [newUser, setNewUser] = useState({ name: '', role: 'caissier', identifiant: '', password: '', email: '' });

  // --- SYNCHRONISATION FIREBASE (TEMPS RÉEL) ---
  useEffect(() => {
    // Écoute des Produits
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    });

    // Écoute des Utilisateurs
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const usrs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usrs);
    });

    // Écoute des Ventes (Triées par date)
    const qSales = query(collection(db, "sales"), orderBy("date", "desc"));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        // Reconversion de la date Firebase en date Javascript
        date: doc.data().date?.toDate() || new Date() 
      }));
      setSalesHistory(sales);
      setIsLoading(false);
    });

    // Nettoyage à la fermeture
    return () => {
      unsubProducts();
      unsubUsers();
      unsubSales();
    };
  }, []);


  // --- AUTHENTIFICATION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (requires2FA) {
      if (code2FA === expected2FACode) {
        setCurrentUser(pendingUser);
        setIsLocked(false);
        setIdentifiantInput('');
        setPasswordInput('');
        setCode2FA('');
        setExpected2FACode('');
        setRequires2FA(false);
        setPendingUser(null);
        setCurrentView('caisse');
        setLoginError(false);
      } else {
        setLoginError(true);
        setCode2FA('');
      }
    } else {
      let user = users.find(u => u.identifiant.toLowerCase() === identifiantInput.toLowerCase() && u.password === passwordInput);
      
      // ASTUCE : Si la base est totalement vide (premier lancement), on force la création de l'admin
      if (!user && users.length === 0 && identifiantInput === 'admin' && passwordInput === '3333') {
        const firstAdmin = { name: 'Admin Principal', identifiant: 'admin', password: '3333', role: 'admin' };
        await setDoc(doc(db, "users", "admin"), firstAdmin);
        user = firstAdmin;
      }

      if (user) {
        setPendingUser(user);
        const tempCode = Math.floor(1000 + Math.random() * 9000).toString();
        setExpected2FACode(tempCode);
        console.log(`[SIMULATION SERVEUR] E-mail envoyé à ${user.identifiant} : code ${tempCode}`);
        setRequires2FA(true);
        setLoginError(false);
      } else {
        setLoginError(true);
        setPasswordInput('');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLocked(true);
    setRequires2FA(false);
    setCode2FA('');
    setPasswordInput('');
    setIdentifiantInput('');
    setCart([]);
  };

  // --- GESTION DU PANIER ---
  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id, delta) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    const newQuantity = item.quantity + delta;
    if (newQuantity > 0) {
      setCart(cart.map(i => (i.id === id ? { ...i, quantity: newQuantity } : i)));
    } else if (newQuantity === 0) {
      setCart(cart.filter(i => i.id !== id));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // --- ENCAISSEMENT & FIREBASE ---
  const processPayment = async (method) => {
    const newSale = {
      date: new Date(),
      items: cart,
      total: cartTotal,
      method: method,
      vendeur: currentUser.name
    };

    // 1. Sauvegarder la vente dans Firebase
    await addDoc(collection(db, "sales"), newSale);

    // 2. Déduire les stocks dans Firebase
    for (const item of cart) {
      const productRef = doc(db, "products", item.id);
      const productInDB = products.find(p => p.id === item.id);
      if (productInDB && trackStock) {
        await updateDoc(productRef, {
          stock: productInDB.stock - item.quantity
        });
      }
    }

    setCart([]);
    setShowPaymentModal(false);
    setIsMobileCartOpen(false);
  };

  // --- ANNULATION D'UNE VENTE & FIREBASE ---
  const confirmCancelSale = async () => {
    const sale = salesHistory.find(s => s.id === saleToCancel);
    if (!sale) return;

    // 1. Restaurer les stocks dans Firebase
    for (const item of sale.items) {
      const productRef = doc(db, "products", item.id);
      const productInDB = products.find(p => p.id === item.id);
      if (productInDB && trackStock) {
        await updateDoc(productRef, {
          stock: productInDB.stock + item.quantity
        });
      }
    }

    // 2. Supprimer la vente de Firebase
    await deleteDoc(doc(db, "sales", sale.id));
    setSaleToCancel(null);
  };

  // --- EXPORT CSV ---
  const exportToCSV = () => {
    if (salesHistory.length === 0) {
      alert("Aucune vente à exporter.");
      return;
    }
    let csvContent = "Date,Vendeur,Categorie,Produit,Prix,Mode_Paiement\n";
    salesHistory.forEach(sale => {
      const dateStr = sale.date.toLocaleDateString('fr-FR');
      sale.items.forEach(item => {
        for (let i = 0; i < item.quantity; i++) {
          csvContent += `"${dateStr}","${sale.vendeur}","${item.category}","${item.name}","${item.price}","${sale.method}"\n`;
        }
      });
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `export_ventes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- GESTION ADMIN (PRODUITS) ---
  const allowedCategories = currentUser?.role === 'chef_buvette' 
    ? ['Buvette'] 
    : currentUser?.role === 'chef_librairie' 
      ? ['Librairie', 'Bazar'] 
      : categories;

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;
    
    const categoryToUse = allowedCategories.includes(newProduct.category) ? newProduct.category : allowedCategories[0];

    // Ajout dans Firebase
    await addDoc(collection(db, "products"), {
      name: newProduct.name,
      category: categoryToUse,
      price: parseFloat(newProduct.price),
      stock: trackStock ? parseInt(newProduct.stock || 0) : 0,
      image: newProduct.image
    });
    
    setNewProduct({ name: '', price: '', category: allowedCategories[0], image: '', stock: '' });
  };

  const updateProductStock = async (id, newStock) => {
    const stock = parseInt(newStock);
    if (isNaN(stock)) return;
    await updateDoc(doc(db, "products", id), { stock });
  };

  const updateProductPrice = async (id, newPrice) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;
    await updateDoc(doc(db, "products", id), { price });
  };

  const deleteProduct = async (id) => {
    await deleteDoc(doc(db, "products", id));
    setCart(cart.filter(c => c.id !== id));
  };

  // --- GESTION ADMIN (UTILISATEURS) ---
  const generatePassword = () => {
    const pass = Math.floor(1000 + Math.random() * 9000).toString();
    setNewUser({ ...newUser, password: pass });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.identifiant || !newUser.password) return;
    
    if (users.find(u => u.identifiant.toLowerCase() === newUser.identifiant.toLowerCase())) {
      setNewUser({ ...newUser, identifiant: '' }); 
      return;
    }

    // Ajout dans Firebase avec l'identifiant comme ID de document pour éviter les doublons
    await setDoc(doc(db, "users", newUser.identifiant.toLowerCase()), {
      name: newUser.name, 
      identifiant: newUser.identifiant, 
      password: newUser.password, 
      role: newUser.role,
      email: newUser.email
    });

    if (newUser.email) {
      console.log(`[SIMULATION SERVEUR] Un e-mail automatique a été expédié à ${newUser.email} avec le code PIN ${newUser.password}.`);
    }

    setNewUser({ name: '', role: 'caissier', identifiant: '', password: '', email: '' });
  };

  const deleteUser = async (identifiant) => {
    if (identifiant === currentUser.identifiant) return;
    const userToDelete = users.find(u => u.identifiant === identifiant);
    if (userToDelete) {
      await deleteDoc(doc(db, "users", userToDelete.id));
    }
  };


  // --- RENDUS DES VUES ---
  const filteredProducts = products.filter(p => {
    const matchCategory = activeCategory === 'Toutes' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">Connexion à la base de données...</div>;
  }

  // ÉCRAN DE VERROUILLAGE
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center border border-slate-100">
          <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            {requires2FA ? <Shield className="text-purple-600" size={32} /> : <Store className="text-purple-600" size={32} />}
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            {requires2FA ? 'Sécurité 2FA' : 'Ma Caisse ACBT'}
          </h1>
          <p className="text-slate-500 mb-6">
            {requires2FA ? 'Entrez le code à 4 chiffres envoyé par e-mail' : 'Connectez-vous à votre espace'}
          </p>
          
          {loginError && (
            <p className="text-red-500 font-medium mb-4 bg-red-50 py-2 rounded-lg">
              {requires2FA ? 'Code d\'authentification incorrect' : 'Identifiant ou code PIN incorrect'}
            </p>
          )}

          <form onSubmit={handleLogin} className="space-y-4 mb-6">
            {!requires2FA && (
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Identifiant (ex: jean)"
                  value={identifiantInput}
                  onChange={(e) => setIdentifiantInput(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-center font-medium"
                  required
                />
              </div>
            )}
            
            <div className="flex justify-center gap-2 mb-8">
              {[0, 1, 2, 3].map((index) => {
                const currentLength = requires2FA ? code2FA.length : passwordInput.length;
                return (
                  <div key={index} className={`w-10 h-12 sm:w-12 sm:h-14 rounded-2xl border-2 flex items-center justify-center text-3xl transition-all duration-200 ${currentLength > index ? 'border-purple-600 bg-purple-50 text-purple-600 shadow-sm scale-110' : 'border-slate-200 bg-slate-50 text-transparent'}`}>
                    {currentLength > index ? '•' : ''}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto mb-8">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button key={num} type="button" onClick={() => { requires2FA ? (code2FA.length < 4 && setCode2FA(prev => prev + num)) : (passwordInput.length < 4 && setPasswordInput(prev => prev + num)) }} className="h-16 text-2xl font-semibold bg-slate-100 text-slate-800 rounded-2xl hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition-all">
                  {num}
                </button>
              ))}
              <button type="button" onClick={() => { requires2FA ? setCode2FA('') : setPasswordInput('') }} className="h-16 text-xl font-bold text-red-500 bg-slate-100 rounded-2xl hover:bg-red-100 active:bg-red-200 active:scale-95 transition-all">C</button>
              <button type="button" onClick={() => { requires2FA ? (code2FA.length < 4 && setCode2FA(prev => prev + '0')) : (passwordInput.length < 4 && setPasswordInput(prev => prev + '0')) }} className="h-16 text-2xl font-semibold bg-slate-100 text-slate-800 rounded-2xl hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition-all">0</button>
              <button type="button" onClick={() => { requires2FA ? setCode2FA(prev => prev.slice(0, -1)) : setPasswordInput(prev => prev.slice(0, -1)) }} className="h-16 text-2xl flex items-center justify-center font-bold text-slate-600 bg-slate-100 rounded-2xl hover:bg-slate-200 active:bg-slate-300 active:scale-95 transition-all">⌫</button>
            </div>

            <button type="submit" disabled={requires2FA ? code2FA.length !== 4 : (!identifiantInput || passwordInput.length !== 4)} className="w-full bg-purple-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-200">
              {requires2FA ? 'Valider le code' : 'Continuer'}
            </button>

            {requires2FA && (
              <button type="button" onClick={() => { setRequires2FA(false); setCode2FA(''); setExpected2FACode(''); setPendingUser(null); setPasswordInput(''); }} className="w-full py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-medium transition-colors mt-2">
                Retour
              </button>
            )}
          </form>

          <div className="mt-8 text-left bg-slate-50 p-4 rounded-xl text-sm border border-slate-200">
            <p className="font-semibold text-slate-700 mb-2">Comptes configurés en base :</p>
            {users.length === 0 ? (
              <div className="text-red-500 p-2 bg-red-50 rounded">⚠️ Base vide. Utilisez <b>admin / 3333</b> pour créer le premier compte.</div>
            ) : (
              <ul className="space-y-2">
                {users.map(u => (
                  <li key={u.id} className="flex flex-col text-slate-600 pb-2 border-b border-slate-200 last:border-0 last:pb-0">
                    <div className="flex justify-between font-medium">
                      <span>{u.name} <span className="text-xs opacity-75">({u.role})</span></span>
                    </div>
                    <div className="flex justify-between text-xs mt-1 items-center">
                      <span className="bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-medium">ID: {u.identifiant}</span>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">PIN: {u.password}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {requires2FA && (
              <div className="mt-3 p-2 bg-purple-50 text-purple-700 rounded-lg text-xs text-center border border-purple-100">
                ℹ️ Code reçu par mail (simulation) : <b>{expected2FACode}</b>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // COMPOSANTS DE L'INTERFACE PRINCIPALE
  return (
    <div className="h-screen bg-slate-100 flex flex-col overflow-hidden">
      
      {/* HEADER TOP */}
      <header className="bg-slate-900 text-white h-16 flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Store className="text-purple-400" />
          <h1 className="text-xl font-bold hidden sm:block">Ma Caisse ACBT</h1>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button onClick={() => setCurrentView('caisse')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentView === 'caisse' ? 'bg-purple-600' : 'hover:bg-slate-800'}`}>Caisse</button>
          <button onClick={() => setCurrentView('historique')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentView === 'historique' ? 'bg-purple-600' : 'hover:bg-slate-800'}`}>Historique</button>
          {['admin', 'chef_buvette', 'chef_librairie'].includes(currentUser?.role) && (
            <button onClick={() => setCurrentView('gestion')} className={`px-4 py-2 rounded-lg font-medium transition-colors ${currentView === 'gestion' ? 'bg-purple-600' : 'hover:bg-slate-800'}`}>Gestion</button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{currentUser?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{currentUser?.role === 'caissier' ? 'Vendeur' : currentUser?.role}</p>
          </div>
          <button onClick={handleLogout} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-white">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="flex-1 flex overflow-hidden relative pb-16 md:pb-0">
        
        {/* VUE CAISSE */}
        {currentView === 'caisse' && (
          <>
            <div className="flex-1 flex flex-col h-full bg-slate-100">
              <div className="bg-white border-b border-slate-200 p-3 overflow-x-auto whitespace-nowrap hide-scrollbar shrink-0">
                <div className="flex gap-2">
                  {['Toutes', ...categories].map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${activeCategory === cat ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{cat}</button>
                  ))}
                </div>
              </div>
              
              <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Rechercher un produit..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-all" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 pb-20 md:pb-0">
                  {filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-slate-500 flex flex-col items-center">
                      <Store size={48} className="mb-4 opacity-20" />
                      <p>Le catalogue est vide.</p>
                      {['admin', 'chef_buvette', 'chef_librairie'].includes(currentUser?.role) && (
                        <button onClick={() => {setCurrentView('gestion'); setAdminTab('produits')}} className="mt-4 text-purple-600 font-medium underline">Ajouter des produits</button>
                      )}
                    </div>
                  ) : (
                    filteredProducts.map(product => (
                      <div key={product.id} onClick={() => addToCart(product)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all flex flex-col items-center text-center">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-24 h-24 object-cover rounded-lg mb-3 bg-slate-100" />
                        ) : (
                          <div className="w-24 h-24 flex items-center justify-center rounded-lg mb-3 bg-slate-100 text-slate-400"><Store size={32} /></div>
                        )}
                        <h3 className="font-semibold text-slate-800 leading-tight mb-1">{product.name}</h3>
                        <p className="text-purple-600 font-black text-lg mb-1">{product.price.toFixed(2)} €</p>
                        {trackStock && <p className={`text-xs ${product.stock <= 0 ? 'text-orange-500 font-bold' : 'text-slate-500'}`}>Stock: {product.stock}</p>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Panier */}
            <div className={`fixed md:static inset-0 z-30 md:z-auto bg-slate-900/50 md:bg-transparent transition-opacity ${isMobileCartOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}`}>
              <div className={`absolute md:static top-0 right-0 bottom-16 md:bottom-0 w-full sm:w-96 bg-white shadow-2xl md:shadow-none border-l border-slate-200 flex flex-col transition-transform duration-300 ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-lg"><ShoppingCart />Commande</div>
                  <button onClick={() => setCart([])} className="text-slate-400 hover:text-red-500 text-sm font-medium transition-colors">Vider</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400"><ShoppingCart size={48} className="mb-4 opacity-20" /><p>Le panier est vide</p></div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-slate-800 truncate">{item.name}</h4>
                            <p className="text-purple-600 font-medium">{item.price.toFixed(2)} €</p>
                          </div>
                          <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1 border border-slate-200">
                            <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white hover:text-red-500 rounded-md transition-colors shadow-sm">{item.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button>
                            <span className="w-6 text-center font-bold text-slate-800">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-white hover:text-purple-600 rounded-md transition-colors shadow-sm"><Plus size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-slate-600 font-medium">Total</span>
                    <span className="text-3xl font-bold text-slate-900">{cartTotal.toFixed(2)} €</span>
                  </div>
                  <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full bg-purple-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-200 flex items-center justify-center gap-2">Encaisser</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* VUE HISTORIQUE */}
        {currentView === 'historique' && (
          <div className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Historique des ventes</h2>
                {currentUser?.role === 'admin' && salesHistory.length > 0 && (
                  <button onClick={exportToCSV} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"><Download size={18} />Exporter (CSV)</button>
                )}
              </div>

              {salesHistory.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 shadow-sm">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Aucune vente enregistrée aujourd'hui.</p>
                </div>
              ) : (
                <div className="space-y-4 pb-20 md:pb-0">
                  {salesHistory.map(sale => (
                    <div key={sale.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-800">{sale.date.toLocaleDateString('fr-FR')} à {sale.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">Vendeur: {sale.vendeur}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {sale.items.map(item => (
                            <span key={item.id} className="text-xs font-medium bg-purple-50 text-purple-700 px-2 py-1 rounded-md border border-purple-100">{item.quantity}x {item.name}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4">
                        <div className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-200 text-sm">
                          {sale.method === 'CB' ? <CreditCard size={14} /> : <Banknote size={14} />}{sale.method}
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="font-bold text-lg text-slate-900">{sale.total.toFixed(2)} €</span>
                           <button onClick={() => setSaleToCancel(sale.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors border border-transparent hover:border-red-200" title="Annuler la vente"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VUE GESTION */}
        {currentView === 'gestion' && ['admin', 'chef_buvette', 'chef_librairie'].includes(currentUser?.role) && (
          <div className="flex-1 bg-slate-50 p-4 md:p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              
              <div className="flex items-center gap-2 mb-6 bg-white p-1 rounded-lg inline-flex shadow-sm border border-slate-200">
                <button onClick={() => setAdminTab('produits')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${adminTab === 'produits' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}><Store size={16} /> Catalogue</button>
                {currentUser?.role === 'admin' && (
                  <>
                    <button onClick={() => setAdminTab('vendeurs')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${adminTab === 'vendeurs' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}><Users size={16} /> Équipe</button>
                    <button onClick={() => setAdminTab('parametres')} className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${adminTab === 'parametres' ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}><Settings size={16} /> Paramètres</button>
                  </>
                )}
              </div>

              {adminTab === 'produits' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-20 md:mb-0">
                  <div className="p-4 bg-slate-900 text-white">
                    <h3 className="font-semibold flex items-center gap-2"><Plus size={18} /> Ajouter un produit</h3>
                  </div>
                  <form onSubmit={handleAddProduct} className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-200 bg-slate-50">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Nom du produit</label>
                      <input type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" required />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">URL de l'image (Optionnel)</label>
                      <input type="text" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Catégorie</label>
                      <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                        {allowedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Prix (€)</label>
                      <input type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" required />
                    </div>
                    {trackStock && (
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Stock initial</label>
                        <input type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" required />
                      </div>
                    )}
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors h-[42px] flex items-center justify-center gap-2"><Plus size={18} /> Ajouter</button>
                    </div>
                  </form>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Produit</th>
                          <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Catégorie</th>
                          <th className="p-3 text-xs font-semibold text-slate-500 uppercase w-32">Prix (€)</th>
                          {trackStock && <th className="p-3 text-xs font-semibold text-slate-500 uppercase w-40">Stock</th>}
                          <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {products.filter(p => allowedCategories.includes(p.category)).map(p => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="p-3 font-medium text-slate-800">{p.name}</td>
                            <td className="p-3 text-slate-600">{p.category}</td>
                            <td className="p-3">
                              <input type="number" step="0.01" value={p.price} onChange={(e) => updateProductPrice(p.id, e.target.value)} className="w-16 p-1 text-center border border-slate-300 rounded" />
                            </td>
                            {trackStock && (
                              <td className="p-3">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => updateProductStock(p.id, p.stock - 1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Minus size={14}/></button>
                                  <input type="number" value={p.stock} onChange={(e) => updateProductStock(p.id, e.target.value)} className={`w-16 p-1 text-center border rounded ${p.stock <= 5 ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-300'}`} />
                                  <button onClick={() => updateProductStock(p.id, p.stock + 1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Plus size={14}/></button>
                                </div>
                              </td>
                            )}
                            <td className="p-3 text-right">
                              <button onClick={() => deleteProduct(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {adminTab === 'vendeurs' && currentUser?.role === 'admin' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-20 md:mb-0">
                  <div className="p-4 bg-slate-900 text-white">
                    <h3 className="font-semibold flex items-center gap-2"><User size={18} /> Ajouter un membre</h3>
                  </div>
                  <form onSubmit={handleAddUser} className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 border-b border-slate-200 bg-slate-50 items-end">
                    <div className="lg:col-span-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Nom</label>
                      <input type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" required />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Identifiant</label>
                      <input type="text" value={newUser.identifiant} onChange={e => setNewUser({...newUser, identifiant: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" required />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">E-mail (Envoi)</label>
                      <input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Rôle</label>
                      <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none">
                        <option value="caissier">Vendeur</option>
                        <option value="chef_buvette">Chef Buvette</option>
                        <option value="chef_librairie">Chef Librairie</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="lg:col-span-1 relative">
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Code PIN</label>
                      <div className="flex gap-2">
                        <input type="text" value={newUser.password} readOnly className="w-full p-2 border border-slate-300 rounded-lg bg-white font-mono text-center text-sm tracking-widest" required />
                        <button type="button" onClick={generatePassword} className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"><Key size={20} /></button>
                      </div>
                    </div>
                    <div className="lg:col-span-1">
                      <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors h-[42px] whitespace-nowrap">Ajouter</button>
                    </div>
                  </form>
                  
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Nom</th>
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Identifiant</th>
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Rôle</th>
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase">Code PIN</th>
                        <th className="p-3 text-xs font-semibold text-slate-500 uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map(u => (
                        <tr key={u.identifiant} className="hover:bg-slate-50/50">
                          <td className="p-3 font-medium text-slate-800">{u.name}</td>
                          <td className="p-3 text-slate-600 font-medium">{u.identifiant}</td>
                          <td className="p-3 capitalize"><span className="px-2 py-1 rounded-md text-xs border bg-slate-100">{u.role}</span></td>
                          <td className="p-3 font-mono text-slate-600 text-sm">{u.password}</td>
                          <td className="p-3 text-right">
                            <button onClick={() => deleteUser(u.identifiant)} disabled={u.identifiant === currentUser?.identifiant} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {adminTab === 'parametres' && currentUser?.role === 'admin' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-20 md:mb-0 p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Settings className="text-slate-800" size={24} />
                    <h3 className="font-bold text-xl text-slate-800">Paramètres généraux</h3>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <p className="font-bold text-slate-800">Suivi des stocks</p>
                      <p className="text-sm text-slate-500 mt-1">Afficher et gérer les quantités en stock.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={trackStock} onChange={() => setTrackStock(!trackStock)} />
                      <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* NAVIGATION BOTTOM MOBILE */}
      <nav className="md:hidden bg-white border-t border-slate-200 flex justify-around items-center h-16 shrink-0 fixed bottom-0 left-0 w-full z-40 pb-safe">
        <button onClick={() => { setCurrentView('caisse'); setIsMobileCartOpen(false); }} className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'caisse' && !isMobileCartOpen ? 'text-purple-600' : 'text-slate-500'}`}><Store size={20} /><span className="text-[10px] mt-1 font-medium">Catalogue</span></button>
        <button onClick={() => { setCurrentView('caisse'); setIsMobileCartOpen(true); }} className={`flex flex-col items-center justify-center w-full h-full relative ${isMobileCartOpen ? 'text-purple-600' : 'text-slate-500'}`}>
          <div className="relative"><ShoppingCart size={20} />{cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cart.reduce((a, c) => a + c.quantity, 0)}</span>}</div>
          <span className="text-[10px] mt-1 font-medium">Panier</span>
        </button>
        <button onClick={() => { setCurrentView('historique'); setIsMobileCartOpen(false); }} className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'historique' ? 'text-purple-600' : 'text-slate-500'}`}><History size={20} /><span className="text-[10px] mt-1 font-medium">Historique</span></button>
        {['admin', 'chef_buvette', 'chef_librairie'].includes(currentUser?.role) && (
          <button onClick={() => { setCurrentView('gestion'); setIsMobileCartOpen(false); }} className={`flex flex-col items-center justify-center w-full h-full ${currentView === 'gestion' ? 'text-purple-600' : 'text-slate-500'}`}><Settings size={20} /><span className="text-[10px] mt-1 font-medium">Gestion</span></button>
        )}
      </nav>

      {/* MODALES */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center border-b border-slate-100 bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800 mb-1">Montant à encaisser</h3>
              <p className="text-4xl font-black text-purple-600">{cartTotal.toFixed(2)} €</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => processPayment('Carte')} className="flex flex-col items-center gap-3 p-4 border-2 border-slate-200 rounded-2xl hover:border-purple-600 hover:bg-purple-50 transition-all text-slate-700 hover:text-purple-700"><CreditCard size={32} /><span className="font-semibold">Carte</span></button>
                <button onClick={() => processPayment('Espèces')} className="flex flex-col items-center gap-3 p-4 border-2 border-slate-200 rounded-2xl hover:border-emerald-600 hover:bg-emerald-50 transition-all text-slate-700 hover:text-emerald-700"><Banknote size={32} /><span className="font-semibold">Espèces</span></button>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="w-full mt-4 py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-medium transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {saleToCancel !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6 text-center bg-red-50"><Trash2 size={32} className="mx-auto text-red-600 mb-2" /><h3 className="text-xl font-bold text-red-800">Annuler la vente ?</h3></div>
            <div className="p-6 flex flex-col gap-3">
              <button onClick={confirmCancelSale} className="w-full bg-red-600 text-white rounded-xl py-3 font-bold hover:bg-red-700">Oui, annuler</button>
              <button onClick={() => setSaleToCancel(null)} className="w-full py-3 text-slate-500 hover:bg-slate-100 rounded-xl font-medium">Non, conserver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
