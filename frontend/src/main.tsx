import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { RouteErrorBoundary } from './lib/features/RouteBoundary';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// Lưới an toàn ngoài cùng. `wrapRoute` đã bọc từng trang, nhưng lỗi ở NGOÀI phạm vi
// trang — bố cục, thanh bên, các provider — thì không lớp nào đỡ. Trước bản vá này,
// một lỗi như vậy gỡ nguyên gốc React và để lại màn hình trắng tuyệt đối: không thông
// báo, không nút bấm, không dấu vết. Đây là lớp cuối cùng bảo đảm cán bộ luôn thấy chữ.
createRoot(root).render(
  <StrictMode>
    <RouteErrorBoundary>
      <App />
    </RouteErrorBoundary>
  </StrictMode>,
);
