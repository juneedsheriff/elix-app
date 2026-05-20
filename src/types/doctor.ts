export type Doctor = {
  id: string;
  full_name: string;
  specialty: string;
  years_experience: number;
  hospital: string;
  rating: number;
  languages: string;
  fee_usd: number;
  image_url: string;
  country: string;
  bio: string | null;
  email: string;
  phone: string;
  auth_user_id?: string | null;
};
