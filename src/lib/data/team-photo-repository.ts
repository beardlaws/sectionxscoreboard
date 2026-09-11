export interface TeamPhotoRepository {
  getApprovedPhotosForGameIds(gameIds: string[]): Promise<any[]>
}
