type TagProps = {
  label: string;
};

export default function Tag({ label }: TagProps) {
  return <span className='tag'>{label}</span>;
}
