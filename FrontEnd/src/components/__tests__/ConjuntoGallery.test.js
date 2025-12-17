import React from 'react';
import { render, screen } from '@testing-library/react';
import ConjuntoGallery from '../ConjuntoGallery';

describe('ConjuntoGallery', () => {
  test('does not render pieces with empty or missing filho codes', () => {
    const conj = [
      { filho: 'ABC123', filho_des: 'Peça A', qtd_explosao: 1 },
      { filho: '', filho_des: 'Vazio' },
      { filho: null, filho_des: 'Nulo' },
      { /* missing filho */ filho_des: 'Sem código' }
    ];

    const { container } = render(<ConjuntoGallery conjuntos={conj} />);

    // Should render only one valid piece
    expect(container.querySelectorAll('.conjunto-item').length).toBe(1);

    // The rendered image should reference the valid código
    const img = screen.getByAltText('ABC123 - Peça A');
    expect(img).toBeInTheDocument();
  });

  test('returns null when no valid pieces', () => {
    const conj = [
      { filho: '', filho_des: 'Vazio' },
      { filho: null }
    ];

    const { container } = render(<ConjuntoGallery conjuntos={conj} />);
    expect(container.querySelector('.conjunto-gallery')).toBeNull();
  });
});
