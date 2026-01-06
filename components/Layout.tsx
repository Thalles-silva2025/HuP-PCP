
import React, { useState, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Scissors, 
  Package, 
  Layers, 
  ShoppingBag, 
  Users, 
  Settings, 
  Menu,
  X,
  FileText,
  BarChart3,
  Shirt,
  Database,
  ClipboardCheck,
  PackageCheck,
  DollarSign,
  ChevronDown,
  ChevronRight,
  Circle,
  Target,
  LogOut,
  User as UserIcon,
  CreditCard
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItemProps {
  icon: any;
  label: string;
  to?: string;
  active?: boolean;
  collapsed?: boolean;
  subItems?: { label: string, to: string }[];
  isOpen?: boolean;
  onToggle?: () => void;
}

const SidebarItem: React.FC<MenuItemProps> = ({ icon: Icon, label, to, active, collapsed, subItems, isOpen, onToggle }) => {
  const Wrapper = subItems ? 'button' : Link;
  const props = subItems ? { onClick: onToggle } : { to: to! };

  return (
    <div className="mb-1">
      <Wrapper 
        {...props as any}
        className={`flex items-center w-full gap-3 p-3 rounded-lg transition-all whitespace-nowrap justify-between
          ${active && !subItems 
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }
          ${collapsed ? 'justify-center' : ''}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <Icon size={20} className="min-w-[20px]" />
          <span className={`font-medium text-sm transition-all duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
            {label}
          </span>
        </div>
        {subItems && !collapsed && (
           isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>
        )}
      </Wrapper>
      
      {subItems && isOpen && !collapsed && (
        <div className="ml-4 pl-4 border-l border-slate-700 mt-1 space-y-1">
           {subItems.map((sub, idx) => (
             <Link 
               key={idx} 
               to={sub.to}
               className="flex items-center gap-2 p-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded"
             >
               <Circle size={6} className={location.hash.includes(sub.to.split('?')[1]) ? 'fill-blue-500 text-blue-500' : 'text-slate-600'}/>
               {sub.label}
             </Link>
           ))}
        </div>
      )}
    </div>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de usuário ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
            setUserMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (label: string) => {
      setOpenSubMenu(openSubMenu === label ? null : label);
  };

  const handleSignOut = async () => {
      await signOut();
      navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Target, label: 'Metas de Produção', path: '/goals' },
    { icon: Database, label: 'Cadastros', path: '/settings' },
    { icon: Shirt, label: 'Fichas Técnicas', path: '/tech-packs' },
    { icon: Layers, label: 'Ordens de Produção', path: '/ops' },
    { 
      icon: Scissors, 
      label: 'Sala de Corte', 
      subItems: [
        { label: 'Parado / Planejado', to: '/cutting?tab=planning' },
        { label: 'Em Andamento', to: '/cutting?tab=active' },
        { label: 'Finalizados', to: '/cutting?tab=done' },
      ]
    },
    { icon: Users, label: 'Facções', path: '/subcontractors' },
    { icon: ClipboardCheck, label: 'Revisão / Qualidade', path: '/revision' },
    { icon: PackageCheck, label: 'Embalagem', path: '/packing' },
    { icon: Package, label: 'Estoque Acabado', path: '/inventory' },
    { icon: FileText, label: 'Soma de Matéria Prima', path: '/consolidation' },
    { icon: DollarSign, label: 'Pagamentos', path: '/payments' },
    { icon: BarChart3, label: 'Relatórios', path: '/reports' },
  ];

  // Helper para obter iniciais
  const getInitials = (name?: string) => {
      if(!name) return 'U';
      const parts = name.split(' ');
      if(parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const userName = profile?.company_name || user?.email?.split('@')[0] || 'Usuário';
  const userInitials = getInitials(userName);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar Desktop - Hover Effect */}
      <aside 
        className={`hidden md:flex flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out z-20
          ${collapsed ? 'w-20' : 'w-64'}
        `}
        onMouseEnter={() => { setCollapsed(false); }}
        onMouseLeave={() => { setCollapsed(true); setOpenSubMenu(null); setUserMenuOpen(false); }}
      >
        <div className="h-16 flex items-center px-4 border-b border-slate-800 overflow-hidden shrink-0">
          <div className={`font-bold text-xl tracking-wider text-blue-500 flex items-center gap-2 transition-all duration-300 ${collapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
            B<span className="text-white">|</span>HUB
          </div>
          {collapsed && <span className="text-blue-500 font-bold mx-auto text-xl">BH</span>}
        </div>

        <nav className="flex-1 py-4 px-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-700">
          {menuItems.map((item) => (
            <SidebarItem 
              key={item.label}
              icon={item.icon} 
              label={item.label} 
              to={item.path} 
              active={location.pathname === item.path || (item.subItems ? location.pathname.includes('cutting') : false)}
              collapsed={collapsed}
              subItems={item.subItems}
              isOpen={openSubMenu === item.label}
              onToggle={() => handleToggle(item.label)}
            />
          ))}
        </nav>

        {/* User Footer with Popover Menu */}
        <div className="p-4 border-t border-slate-800 relative" ref={userMenuRef}>
          
          {/* Menu Popover */}
          {userMenuOpen && !collapsed && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden animate-fade-in">
                  <Link to="/profile" className="flex items-center gap-3 p-3 hover:bg-slate-700 text-sm text-slate-200 transition-colors">
                      <UserIcon size={16}/> Meu Perfil
                  </Link>
                  <Link to="/plans" className="flex items-center gap-3 p-3 hover:bg-slate-700 text-sm text-slate-200 transition-colors">
                      <CreditCard size={16}/> Ver Planos
                  </Link>
                  <button onClick={handleSignOut} className="w-full flex items-center gap-3 p-3 hover:bg-red-900/30 text-sm text-red-400 transition-colors border-t border-slate-700">
                      <LogOut size={16}/> Sair
                  </button>
              </div>
          )}

          <div 
            className={`flex items-center gap-3 cursor-pointer p-2 -m-2 rounded-lg hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center' : ''}`}
            onClick={() => !collapsed && setUserMenuOpen(!userMenuOpen)}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold min-w-[32px] shadow-lg border border-slate-600">
              {userInitials}
            </div>
            <div className={`flex flex-col whitespace-nowrap transition-all duration-300 overflow-hidden ${collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
              <span className="text-sm font-medium truncate max-w-[140px]">{userName}</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                  Gerenciar <ChevronDown size={10}/>
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Mobile */}
        <header className="md:hidden bg-white h-16 border-b flex items-center justify-between px-4 no-print shrink-0">
          <div className="font-bold text-xl text-blue-600">B-HUB</div>
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="text-gray-600" />
          </button>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div 
              className="absolute inset-0 bg-black/50" 
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative bg-slate-900 text-white w-64 h-full flex flex-col p-4">
               <button 
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-slate-400"
              >
                <X />
              </button>
              <div className="mb-8 font-bold text-2xl mt-2 text-blue-500">B-HUB</div>
              <nav className="flex-1 space-y-1">
                {menuItems.map((item) => (
                  <SidebarItem 
                    key={item.label}
                    icon={item.icon} 
                    label={item.label} 
                    to={item.path} 
                    active={location.pathname === item.path}
                    subItems={item.subItems}
                    isOpen={openSubMenu === item.label}
                    onToggle={() => handleToggle(item.label)}
                    collapsed={false}
                  />
                ))}
              </nav>
              <div className="border-t border-slate-700 pt-4 mt-4 space-y-2">
                  <Link to="/profile" className="flex items-center gap-3 p-2 text-slate-400 hover:text-white"><UserIcon size={18}/> Meu Perfil</Link>
                  <Link to="/plans" className="flex items-center gap-3 p-2 text-slate-400 hover:text-white"><CreditCard size={18}/> Planos</Link>
                  <button onClick={handleSignOut} className="flex items-center gap-3 p-2 text-red-400 hover:text-red-300 w-full text-left"><LogOut size={18}/> Sair</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
