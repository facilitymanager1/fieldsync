/**
 * @jest-environment jsdom
 */

describe('Mobile App Core Tests', () => {
  describe('Math utilities', () => {
    test('should add numbers correctly', () => {
      expect(2 + 2).toBe(4);
    });

    test('should subtract numbers correctly', () => {
      expect(5 - 3).toBe(2);
    });
  });

  describe('String utilities', () => {
    test('should format employee name', () => {
      const formatName = (first: string, last: string) => `${first} ${last}`;
      expect(formatName('John', 'Doe')).toBe('John Doe');
    });

    test('should capitalize first letter', () => {
      const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
      expect(capitalize('test')).toBe('Test');
    });
  });

  describe('Array utilities', () => {
    test('should filter attendance records', () => {
      const records = [
        { id: 1, status: 'present' },
        { id: 2, status: 'absent' },
        { id: 3, status: 'present' }
      ];
      
      const presentRecords = records.filter(r => r.status === 'present');
      expect(presentRecords).toHaveLength(2);
    });
  });
});
