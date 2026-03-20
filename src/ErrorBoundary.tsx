// ErrorBoundary — перехватывает ошибки рендеринга и показывает сообщение вместо белого экрана
import React, { Component, ErrorInfo, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Ошибка приложения:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 p-4">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">Произошла ошибка</h1>
          <p className="mb-4 max-w-md text-sm text-red-700">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
          >
            Обновить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
