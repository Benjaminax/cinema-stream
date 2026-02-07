import React from 'react';
import LocalMovies from './LocalMovies';

const Movies: React.FC = () => {
  console.log('🎥 Movies component is rendering');
  return <LocalMovies />;
};

export default Movies;