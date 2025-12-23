// Date formatting utilities

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    return 'N/A';
  }
};

export const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    return '';
  }
};

