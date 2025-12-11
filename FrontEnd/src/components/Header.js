import "../styles/Header.css";

function Header({ children }) {
  return (
    <header>
      <div className="header-container">
        
        {children}
      </div>
    </header>
  );
}

export default Header;