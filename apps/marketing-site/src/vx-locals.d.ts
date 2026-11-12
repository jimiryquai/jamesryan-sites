// THROWAWAY SPIKE (ticket 25): the visual-editor preview flag set by
// PublishedPage.astro (verified draft preview + ?vx_frame=1 only).
// Read through vx-edit.ts helpers; nothing here merges.
declare namespace App {
	interface Locals {
		vxFrame?: boolean;
	}
}
