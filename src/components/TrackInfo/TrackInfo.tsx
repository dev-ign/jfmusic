import styles from './TrackInfo.module.scss';

export default function TrackInfo() {
  return (
    <div className={styles['track-info']}>
      <h2 className={styles['track-info__title']}>Caramelo</h2>
      <p className={styles['track-info__meta']}>
        <span>Single</span>
        <span className={styles['track-info__dot']} aria-hidden="true" />
        <span>2:17</span>
        <span className={styles['track-info__dot']} aria-hidden="true" />
        <span>2026</span>
      </p>
    </div>
  );
}
