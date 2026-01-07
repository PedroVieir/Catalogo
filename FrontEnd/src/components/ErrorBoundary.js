import React from "react";

/**
 * ErrorBoundary - Captura erros não tratados em componentes filhos
 * Exibe mensagem de erro amigável e oferece opção de recarregar
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary capturou erro:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <h1 style={styles.title}> Algo deu errado</h1>
            <p style={styles.message}>
              Desculpe, ocorreu um erro inesperado na aplicação.
            </p>

            {process.env.NODE_ENV === "development" && (
              <details style={styles.details}>
                <summary style={styles.summary}>Detalhes do erro (desenvolvimento)</summary>
                <pre style={styles.errorText}>
                  {this.state.error && this.state.error.toString()}
                  {"\n\n"}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button onClick={this.handleReload} style={styles.button}>
              🔄 Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#f5f7fb",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif"
  },
  content: {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "40px",
    maxWidth: "600px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    textAlign: "center"
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    color: "#1f2933",
    marginBottom: "16px"
  },
  message: {
    fontSize: "16px",
    color: "#666",
    marginBottom: "24px",
    lineHeight: "1.5"
  },
  button: {
    backgroundColor: "#0066cc",
    color: "white",
    border: "none",
    padding: "12px 24px",
    fontSize: "16px",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "background-color 0.2s"
  },
  details: {
    marginBottom: "24px",
    textAlign: "left"
  },
  summary: {
    cursor: "pointer",
    color: "#0066cc",
    fontWeight: "bold",
    marginBottom: "12px"
  },
  errorText: {
    backgroundColor: "#f5f7fb",
    padding: "12px",
    borderRadius: "6px",
    overflow: "auto",
    fontSize: "12px",
    color: "#1f2933",
    maxHeight: "200px"
  }
};

export default ErrorBoundary;
