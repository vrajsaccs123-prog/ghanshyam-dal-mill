export type RateItem = {
  name: string;
  note: string;
  amount: number | null;
  extra: string;
};

export type Category = {
  id: string;
  name: string;
  items: RateItem[];
};

export type RateDay = {
  id: string;
  /** Column heading from the sheet, cleaned when it is a date. */
  displayDate: string;
  weekday: string;
  categories: Category[];
};

export type RateBook = {
  /** Newest date column first. */
  days: RateDay[];
  fetchedAt: string;
};
